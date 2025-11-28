/**
 * Represents usage statistics for a model response.
 * @type {import('ai').LanguageModelUsage}
 */
export default class LanguageModelUsage {
	/** @type {number} - Number of input tokens (prompt tokens) */
	inputTokens
	/** @type {number} - Number of reasoning tokens */
	reasoningTokens
	/** @type {number} - Number of output tokens (completion tokens) */
	outputTokens
	/** @type {number} - Total number of tokens */
	totalTokens

	/**
	 * @param {Partial<import('ai').LanguageModelUsage>} input
	 */
	constructor(input = {}) {
		const {
			inputTokens = 0,
			reasoningTokens = 0,
			outputTokens = 0,
			totalTokens = 0,
		} = input
		this.inputTokens = Number(inputTokens)
		this.reasoningTokens = Number(reasoningTokens)
		this.outputTokens = Number(outputTokens)
		this.totalTokens = Number(totalTokens)
	}
}
