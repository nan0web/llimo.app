import { createOpenAI } from '@ai-sdk/openai'
import { createCerebras } from '@ai-sdk/cerebras'
import { createHuggingFace } from '@ai-sdk/huggingface'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, generateText } from 'ai'
import ModelProvider from "./ModelProvider.js"
import ModelInfo from './ModelInfo.js'
import LanguageModelUsage from './LanguageModelUsage.js'

/**
 * @typedef {Object} StreamOptions callbacks and abort signal
 * @property {AbortSignal} [abortSignal] aborts the request when signaled
 * @property {import('ai').StreamTextOnChunkCallback<import('ai').ToolSet>} [onChunk] called for each raw chunk
 * @property {import('ai').StreamTextOnStepFinishCallback<import('ai').ToolSet>} [onStepFinish] called after a logical step finishes (see description above)
 * @property {import('ai').StreamTextOnErrorCallback} [onError] called on stream error
 * @property {()=>void} [onFinish] called when the stream ends successfully
 * @property {()=>void} [onAbort] called when the stream is aborted
 */

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
	 * @param {object} input
	 * @param {Array<readonly [string, Partial<ModelInfo>]> | Map<string, Partial<ModelInfo>>} input
	 */
	constructor(input = {}) {
		const {
			models = [],
			selectedModel = this.selectedModel,
		} = input
		this.#models = new Map(models)
		this.selectedModel = selectedModel
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
		return Array.from(this.#models.values())
	}

	/**
	 * Get model info by ID.
	 *
	 * @param {string} modelId
	 * @returns {ModelInfo | undefined}
	 */
	getModel(modelId) {
		return this.#models.get(modelId)
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
		this.#models.set(id, new ModelInfo(info))
	}

	/**
	 * Get provider instance for a model.
	 *
	 * @param {string} provider
	 * @returns {any}
	 */
	getProvider(provider) {
		switch (provider) {
			case 'openai':
				if (!process.env.OPENAI_API_KEY) {
					throw new Error(`OpenAI API key is missing. Set the OPENAI_API_KEY environment variable.`)
				}
				return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
			case 'cerebras':
				if (!process.env.CEREBRAS_API_KEY) {
					throw new Error(
						`Cerebras API key is missing. Set the CEREBRAS_API_KEY environment variable.` +
						`\n\n` +
						`To get an API key:\n` +
						`1. Visit https://inference-docs.cerebras.ai/\n` +
						`2. Sign up and get your API key\n` +
						`3. Export it: export CEREBRAS_API_KEY=your_key_here`
					)
				}
				return createCerebras({ apiKey: process.env.CEREBRAS_API_KEY })
			case 'huggingface':
				if (!process.env.HUGGINGFACE_API_KEY) {
					throw new Error(`HuggingFace API key is missing. Set the HUGGINGFACE_API_KEY environment variable.`)
				}
				return createHuggingFace({ apiKey: process.env.HUGGINGFACE_API_KEY })
			case 'openrouter':
				if (!process.env.OPENROUTER_API_KEY) {
					throw new Error(`OpenRouter API key is missing. Set the OPENROUTER_API_KEY environment variable.`)
				}
				return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
			default:
				throw new Error(`Unknown provider: ${provider}`)
		}
	}

	/**
	 * Stream text from a model.
	 *
	 * The method forwards the call to `ai.streamText` while providing a set of
	 * optional hooks that can be used by callers to monitor or control the
	 * streaming lifecycle.
	 *
	 * @param {string} modelId
	 * @param {import('ai').ModelMessage[]} messages
	 * @param {import('ai').UIMessageStreamOptions<import('ai').UIMessage>} [options={}]
	 * @returns {import('ai').StreamTextResult<import('ai').ToolSet>}
	 */
	streamText(modelId, messages, options = {}) {
		const model = this.getModel(modelId)
		if (!model) throw new Error(`Model not found: ${modelId}`)

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
	 * @returns {Promise<{text: string, usage: LanguageModelUsage}>}
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
}


