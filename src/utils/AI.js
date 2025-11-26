import { createOpenAI } from '@ai-sdk/openai'
import { createCerebras } from '@ai-sdk/cerebras'
import { createHuggingFace } from '@ai-sdk/huggingface'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, generateText } from 'ai'

/**
 * Wrapper for AI providers
 */
export default class AI {
	/**
	 * @typedef {Object} ModelInfo
	 * @property {string} id - Model ID
	 * @property {string} provider - Provider name (openai, cerebras, etc.)
	 * @property {number} inputPrice - Price per 1M input tokens
	 * @property {number} outputPrice - Price per 1M output tokens
	 * @property {number} [cachePrice] - Price per 1M cached tokens
	 * @property {boolean} [supportsThinking] - Model supports thinking blocks
	 */

	/** @type {Map<string, ModelInfo>} */
	#models = new Map()

	constructor() {
		this.#initializeModels()
	}

	/**
	 * Initialize available models with pricing
	 */
	#initializeModels() {
		// Cerebras
		this.#models.set('gpt-oss-120b', {
			id: 'gpt-oss-120b',
			provider: 'cerebras',
			inputPrice: 0.20,
			outputPrice: 0.80,
			cachePrice: 0.10,
		})
		// Add more models as needed
		this.#models.set('llama-3.1-8b-instruct', {
			id: 'llama-3.1-8b-instruct',
			provider: 'openrouter',
			inputPrice: 0.05,
			outputPrice: 0.05,
		})
	}

	/**
	 * Get list of available models
	 * @returns {ModelInfo[]}
	 */
	getModels() {
		return Array.from(this.#models.values())
	}

	/**
	 * Get model info by ID
	 * @param {string} modelId
	 * @returns {ModelInfo | undefined}
	 */
	getModel(modelId) {
		return this.#models.get(modelId)
	}

	/**
	 * Get provider instance for a model
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
					throw new Error(`Cerebras API key is missing. Set the CEREBRAS_API_KEY environment variable.\n\nTo get an API key:\n1. Visit https://inference-docs.cerebras.ai/\n2. Sign up and get your API key\n3. Export it: export CEREBRAS_API_KEY=your_key_here`)
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
	 * Stream text from a model
	 * @param {string} modelId
	 * @param {import('ai').ModelMessage[]} messages
	 * @returns {import('ai').StreamTextResult<import('ai').ToolSet>}
	 */
	streamText(modelId, messages) {
		const model = this.getModel(modelId)
		if (!model) throw new Error(`Model not found: ${modelId}`)

		const provider = this.getProvider(model.provider)
		const stream = streamText({
			model: provider(model.id),
			messages,
		})
		return stream
	}

	/**
	 * Generate text from a model
	 * @param {string} modelId
	 * @param {import('ai').ModelMessage[]} messages
	 * @returns {Promise<{text: string, usage: import('ai').LanguageModelUsage}>}
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
