/**
 * Represents usage statistics for a model response.
 * @type {import('ai').LanguageModelUsage}
 */
export default class LanguageModelUsage {
    /**
     * @param {Partial<import('ai').LanguageModelUsage>} input
     */
    constructor(input?: Partial<import("ai").LanguageModelUsage>);
    /** @type {number} - Number of input tokens (prompt tokens) */
    inputTokens: number;
    /** @type {number} - Number of reasoning tokens */
    reasoningTokens: number;
    /** @type {number} - Number of output tokens (completion tokens) */
    outputTokens: number;
    /** @type {number} - Total number of tokens */
    totalTokens: number;
}
