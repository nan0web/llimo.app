/**
 * Represents top provider information for a model.
 */
export default class TopProvider {
	/** @type {number} - Context length */
	context_length
	/** @type {boolean} - Whether the model is moderated */
	is_moderated
	/** @type {number} - Max completion tokens */
	max_completion_tokens

	/**
	 * @param {Partial<TopProvider>} input
	 */
	constructor(input = {}) {
		const {
			context_length = 0,
			is_moderated = false,
			max_completion_tokens = 0,
		} = input
		this.context_length = Number(context_length)
		this.is_moderated = Boolean(is_moderated)
		this.max_completion_tokens = Number(max_completion_tokens)
	}
}
