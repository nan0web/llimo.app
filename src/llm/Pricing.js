/**
 * Represents pricing information for a model.
 */
export default class Pricing {
	/** @type {number} - Completion cost per million tokens */
	completion = -1
	/** @type {number} - Image cost */
	image = -1
	/** @type {number} - Input cache read cost */
	input_cache_read = -1
	/** @type {number} - Input cache write cost */
	input_cache_write = -1
	/** @type {number} - Internal reasoning cost */
	internal_reasoning = -1
	/** @type {number} - Prompt cost per million tokens */
	prompt = -1
	/** @type {number} - Request cost */
	request = -1
	/** @type {number} - Web search cost */
	web_search = -1

	/**
	 * @param {Partial<Pricing>} input
	 */
	constructor(input = {}) {
		const {
			completion = this.completion,
			image = this.image,
			input_cache_read = this.input_cache_read,
			input_cache_write = this.input_cache_write,
			internal_reasoning = this.internal_reasoning,
			prompt = this.prompt,
			request = this.request,
			web_search = this.web_search,
		} = input
		this.completion = Number(completion)
		this.image = Number(image)
		this.input_cache_read = Number(input_cache_read)
		this.input_cache_write = Number(input_cache_write)
		this.internal_reasoning = Number(internal_reasoning)
		this.prompt = Number(prompt)
		this.request = Number(request)
		this.web_search = Number(web_search)
	}

	/**
	 * Returns the Batch discount in %.
	 * @returns {[inputDicount: number, outputDiscount: number]}
	 */
	getBatchDiscount() {
		// @todo implement for those where it works, it is not working with openrouter,
		// but should work with openai.
		return [0, 0]
		if (!this.input_cache_read && this.input_cache_write) return [0, 0]
		return [
			Math.round((1 - this.input_cache_read / this.prompt) * 100),
			Math.round((1 - this.input_cache_write / this.completion) * 100),
		]
	}
}
