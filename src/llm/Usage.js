export class Usage {
	/** @type {number} */
	inputTokens
	/** @type {number} */
	reasoningTokens
	/** @type {number} */
	outputTokens
	/** @type {number} */
	cachedInputTokens
	/** @param {Partial<Usage>} [input] */
	constructor(input = {}) {
		const {
			inputTokens = 0,
			reasoningTokens = 0,
			outputTokens = 0,
			cachedInputTokens = 0,
		} = input
		this.inputTokens = Number(inputTokens)
		this.reasoningTokens = Number(reasoningTokens)
		this.outputTokens = Number(outputTokens)
		this.cachedInputTokens = Number(cachedInputTokens)
	}
	/** @returns {number} */
	get totalTokens() {
		return this.inputTokens + this.reasoningTokens + this.outputTokens
	}
}
