export class Usage {
    /** @param {Partial<Usage>} [input] */
    constructor(input?: Partial<Usage>);
    /** @type {number} */
    inputTokens: number;
    /** @type {number} */
    reasoningTokens: number;
    /** @type {number} */
    outputTokens: number;
    /** @type {number} */
    cachedInputTokens: number;
    /** @returns {number} */
    get totalTokens(): number;
}
