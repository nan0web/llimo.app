/**
 * Represents pricing information for a model.
 */
export default class Pricing {
    /**
     * @param {Partial<Pricing>} input
     */
    constructor(input?: Partial<Pricing>);
    /** @type {number} - Completion cost per million tokens */
    completion: number;
    /** @type {number} - Image cost */
    image: number;
    /** @type {number} - Input cache read cost */
    input_cache_read: number;
    /** @type {number} - Input cache write cost */
    input_cache_write: number;
    /** @type {number} - Internal reasoning cost */
    internal_reasoning: number;
    /** @type {number} - Prompt cost per million tokens */
    prompt: number;
    /** @type {number} - Request cost */
    request: number;
    /** @type {number} - Web search cost */
    web_search: number;
    /**
     * Returns the Batch discount in %.
     * @returns {[inputDicount: number, outputDiscount: number]}
     */
    getBatchDiscount(): [inputDicount: number, outputDiscount: number];
}
