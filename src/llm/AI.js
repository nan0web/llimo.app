import { createOpenAI } from '@ai-sdk/openai'
import { createCerebras } from '@ai-sdk/cerebras'
import { createHuggingFace } from '@ai-sdk/huggingface'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, generateText } from 'ai'
import ModelProvider from "./ModelProvider.js"
import ModelInfo from './ModelInfo.js'
import { validateApiKey } from './ProviderConfig.js'
import Usage from './Usage.js'

/**
 * @typedef {Object} StreamOptions callbacks and abort signal
 * @property {AbortSignal} [abortSignal] aborts the request when signaled
 * @property {import('ai').StreamTextOnChunkCallback<import('ai').ToolSet>} [onChunk] called for each raw chunk
 * @property {import('ai').StreamTextOnStepFinishCallback<import('ai').ToolSet>} [onStepFinish] called after a logical step finishes (see description above)
 * @property {import('ai').StreamTextOnErrorCallback} [onError] called on stream error
 * @property {()=>void} [onFinish] called when the stream ends successfully
 * @property {()=>void} [onAbort] called when the stream is aborted
 */

export class AiStrategy {
	/**
	 * @param {ModelInfo} model
	 * @param {number} tokens
	 * @param {number} [safeAnswerTokens=1_000]
	 * @returns {boolean}
	 */
	shouldChangeModel(model, tokens, safeAnswerTokens = 1e3) {
		if (model.context_length < tokens + safeAnswerTokens) return true
		if (model.per_request_limit > 0 && model.per_request_limit < tokens) return true
		if (model.maximum_output > 0 && model.maximum_output < safeAnswerTokens) return true
		if (model.pricing.prompt < 0 || model.pricing.completion < 0) return true
		if (model.volume && model.volume < 100e9) return true
		if (model.id.endsWith(":free")) return true
		return false
	}
	/**
	 * @param {Map<string, ModelInfo>} models
	 * @param {number} tokens
	 * @param {number} [safeAnswerTokens=1_000]
	 * @returns {ModelInfo | undefined}
	 */
	findModel(models, tokens, safeAnswerTokens = 1e3) {
		const arr = Array.from(models.values()).filter(
			(info) => !this.shouldChangeModel(info, tokens, safeAnswerTokens)
		)
		if (!arr.length) return
		arr.sort((a, b) => a.pricing.completion - b.pricing.completion)

		return arr[0]
	}
}

/**
 * Wrapper for AI providers.
 *
 * Apart from the static model list, the class now exposes a method
 * `refreshModels()` that pulls the latest info from each provider (via
 * `api/models/`) and caches the result for one hour.
 *
 * @class
 */
export default class AI {

	/** @type {Map<string, ModelInfo>} */
	#models = new Map()

	/** @type {ModelProvider} */
	#provider = new ModelProvider()

	/** @type {ModelInfo?} */
	selectedModel = null

	/**
	 * @param {Object} input
	 * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo>} [input.models=[]]
	 * @param {ModelInfo} [input.selectedModel]
	 * @param {AiStrategy} [input.strategy]
	 */
	constructor(input = {}) {
		const {
			models = [],
			selectedModel = this.selectedModel,
			strategy = new AiStrategy()
		} = input
		this.setModels(models)
		this.selectedModel = selectedModel
		this.strategy = strategy
	}

	/**
	 * Flatten and normalize models to Map<string, ModelInfo[]>. Handles:
	 * - Map: Pass-through.
	 * - Array<[string, ModelInfo[]]>: Direct set.
	 * - Array<[string, ModelInfo]>: Wrap singles in arrays.
	 * - Nested providers (e.g., {providers: [{provider:'a'}]}): Expand to prefixed IDs (e.g., 'model:a').
	 * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo> | readonly[string, Partial<ModelInfo> & {providers?: {provider: string}[]}] } models
	 */
	setModels(models) {
		let map = new Map()
		if (models instanceof Map) {
			// Direct Map: flatten singles to arrays
			for (const [id, value] of models) {
				if (!Array.isArray(value)) {
					map.set(id, new ModelInfo(value))
				} else if (value.length) {
					map.set(id, new ModelInfo(value[0]))
				}
			}
		} else if (Array.isArray(models)) {
			// Array format: flatten as needed
			for (const item of models) {
				if (Array.isArray(item)) {
					const [id, value] = item
					if (!Array.isArray(value)) {
						map.set(id, new ModelInfo(value))
					} else if (value.length) {
						map.set(id, new ModelInfo(value[0]))
					}
				} else if (item.providers && Array.isArray(item.providers)) {
					// Nested providers: expand
					const baseId = item.id
					for (const prov of item.providers) {
						const prefixedId = `${baseId}:${prov.provider}`
						const variant = new ModelInfo({ ...item, provider: prov.provider })
						const arr = map.get(prefixedId) ?? []
						arr.push(variant)
						map.set(prefixedId, arr)
					}
				} else {
					// Single object: treat as [id, ModelInfo]
					map.set(item.id, new ModelInfo(item))
				}
			}
		}
		this.#models = map
	}

	/**
	 * Refresh model information from remote providers.
	 *
	 * The method updates the internal `#models` map with the merged static +
	 * remote data. It respects the cache (see `ModelProvider`).
	 *
	 * @returns {Promise<void>}
	 */
	async refreshModels() {
		const remote = await this.#provider.getAll()
		// Merge remote into the internal map – remote wins on ID conflict.
		for (const [id, info] of remote.entries()) {
			this.#models.set(id, info)
		}
	}

	/**
	 * Get list of available models (after optional refresh).
	 *
	 * @returns {ModelInfo[]}
	 */
	getModels() {
		return Array.from(this.#models.values()).flat()
	}

	/**
	 *
	 * @returns {Map<string, ModelInfo>}
	 */
	getModelsMap() {
		return this.#models
	}

	/**
	 * Get model info by ID.
	 *
	 * @param {string} modelId
	 * @returns {ModelInfo[]}
	 */
	getModel(modelId) {
		const keys = Array.from(this.#models.keys()).filter(id => id.startsWith(modelId))
		const result = []
		keys.forEach(key => {
			const info = this.#models.get(key)
			if (info?.id === modelId) {
				result.push(info)
			}
		})
		return result
	}

	/**
	 * Returns the model for the specific provider with absolute equality.
	 * @param {string} model
	 * @param {string} provider
	 * @returns {ModelInfo | undefined}
	 */
	getProviderModel(model, provider) {
		const arr = this.getModel(model)
		return arr.find(p => p.provider === provider)
	}

	/**
	 * Find a model from all of the models by partial comparasion.
	 * @param {string} modelId The full or partial model id.
	 * @returns {ModelInfo | undefined}
	 */
	findModel(modelId) {
		const str = String(modelId).toLowerCase()
		for (const [id, info] of this.#models.entries()) {
			if (String(id).toLowerCase().includes(str)) return info
		}
	}

	/**
	 * Find models that matches modelId from all of the models by partial comparasion.
	 * @param {string} modelId The full or partial model id.
	 * @returns {ModelInfo[]}
	 */
	findModels(modelId) {
		/** @type {ModelInfo[]} */
		const result = []
		const str = String(modelId).toLowerCase()
		const parts = str.split(/[^\w]+/)
		for (const [id, info] of this.#models.entries()) {
			const lc = String(id).toLowerCase()
			if (lc.includes(str)) {
				result.push(info)
			}
			if (parts.some(p => lc.includes(p))) {
				result.push(info)
			}
		}
		result.sort((a, b) => a.id.localeCompare(b.id))
		return result
	}

	/**
	 * Add a model to the internal map (for testing).
	 *
	 * @param {string} id
	 * @param {Partial<ModelInfo>} info
	 */
	addModel(id, info) {
		this.#models.set(`${info.id}@${info.provider}`, new ModelInfo(info))
	}

	/**
	 * Get provider instance for a model.
	 *
	 * @param {string} provider
	 * @returns {any}
	 */
	getProvider(provider) {
		const [pro] = provider.split("/")
		try {
			validateApiKey(pro)
		} catch (/** @type {any} */ err) {
			throw new Error(err.message)
		}
		switch (pro) {
			case 'openai':
				return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
			case 'cerebras':
				return createCerebras({ apiKey: process.env.CEREBRAS_API_KEY })
			case 'huggingface':
				const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY
				return createHuggingFace({ apiKey: HF_TOKEN })
			case 'openrouter':
				return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
			default:
				throw new Error(`Unknown provider: ${provider}`)
		}
	}

	/**
	 * Stream text from a model.
	 *
	 * The method forwards the call to `ai.streamText` while providing a set of
	 * optional hooks that can be used by monitor or control the streaming
	 * lifecycle.
	 *
	 * @param {ModelInfo} model
	 * @param {import('ai').ModelMessage[]} messages
	 * @param {import('ai').UIMessageStreamOptions<import('ai').UIMessage>} [options={}]
	 * @returns {import('ai').StreamTextResult<import('ai').ToolSet>}
	 */
	streamText(model, messages, options = {}) {
		const {
			abortSignal,
			onChunk,
			onStepFinish,
			onError,
			onFinish,
			onAbort,
		} = options

		const system = undefined
		const provider = this.getProvider(model.provider)

		const stream = streamText({
			model: provider(model.id),
			messages,
			system,
			abortSignal,
			includeRawChunks: true,
			onChunk,
			// The SDK currently does not have explicit hooks for step‑finish,
			// but we keep the options here for future compatibility.
			// Consumers can wrap the returned async iterator to implement step
			// detection if needed.
			// @ts-ignore – extra options are ignored by the library for now.
			onStepFinish,
			onError,
			onFinish,
			onAbort,
		})
		return stream
	}

	/**
	 * Generate text from a model (non‑streaming).
	 *
	 * @param {string} modelId
	 * @param {import('ai').ModelMessage[]} messages
	 * @returns {Promise<{text: string, usage: Usage}>}
	 */
	async generateText(modelId, messages) {
		const model = this.getModel(modelId)
		if (!model) throw new Error(`Model not found: ${modelId}`)

		const provider = this.getProvider(model.provider)
		const { text, usage } = await generateText({
			model: provider(model.id),
			messages,
		})
		return { text, usage }
	}

	/**
	 * @throws {Error} When no correspondent model found.
	 * @param {ModelInfo} model
	 * @param {number} tokens
	 * @param {number} [safeAnswerTokens=1_000]
	 * @returns {ModelInfo | undefined}
	 */
	ensureModel(model, tokens, safeAnswerTokens = 1e3) {
		if (!this.strategy.shouldChangeModel(model, tokens, safeAnswerTokens)) {
			return model
		}
		const found = this.strategy.findModel(this.#models, tokens, safeAnswerTokens)
		if (!found) {
			throw new Error("No such model found in " + this.strategy.constructor.name)
		}
		this.selectedModel = found
		return found
	}
}
