/**
 * Represents usage statistics for a model response.
 */
export default class Usage {
    /**
     * @param {Partial<Usage>} input
     */
    constructor(input?: Partial<Usage>);
    /** @type {number} - Number of input tokens (prompt tokens) */
    inputTokens: number;
    /** @type {number} - Number of reasoning tokens */
    reasoningTokens: number;
    /** @type {number} - Number of output tokens (completion tokens) */
    outputTokens: number;
    /** @type {number} - Total number of tokens */
    totalTokens: number;
}
