/**
 * Represents pricing information for a model.
 */
export default class Pricing {
	/** @type {number} - Completion cost per million tokens */
	completion
	/** @type {number} - Image cost */
	image
	/** @type {number} - Input cache read cost */
	input_cache_read
	/** @type {number} - Input cache write cost */
	input_cache_write
	/** @type {number} - Internal reasoning cost */
	internal_reasoning
	/** @type {number} - Prompt cost per million tokens */
	prompt
	/** @type {number} - Request cost */
	request
	/** @type {number} - Web search cost */
	web_search

	/**
	 * @param {Partial<Pricing>} input
	 */
	constructor(input = {}) {
		const {
			completion = 0,
			image = 0,
			input_cache_read = 0,
			input_cache_write = 0,
			internal_reasoning = 0,
			prompt = 0,
			request = 0,
			web_search = 0,
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
}
