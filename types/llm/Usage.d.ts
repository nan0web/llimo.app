export class Limits {
    static rpd: {
        alias: string;
    };
    static rph: {
        alias: string;
    };
    static rpm: {
        alias: string;
    };
    static tpd: {
        alias: string;
    };
    static tph: {
        alias: string;
    };
    static tpm: {
        alias: string;
    };
    /** @param {Partial<Limits>} [input] */
    constructor(input?: Partial<Limits>);
    /** @type {number | undefined} Remaining requests per day */
    rpd: number | undefined;
    /** @type {number | undefined} Remaining requests per hour */
    rph: number | undefined;
    /** @type {number | undefined} Remaining requests per minute */
    rpm: number | undefined;
    /** @type {number | undefined} Remaining tokens per day */
    tpd: number | undefined;
    /** @type {number | undefined} Remaining tokens per hour */
    tph: number | undefined;
    /** @type {number | undefined} Remaining tokens per minute */
    tpm: number | undefined;
    /** @returns {boolean} */
    get empty(): boolean;
}
export class Usage {
    constructor(input?: {});
    /** @type {number} */
    inputTokens: number;
    /** @type {number} */
    reasoningTokens: number;
    /** @type {number} */
    outputTokens: number;
    /** @type {number} */
    cachedInputTokens: number;
    /** @param {Partial<Limits>} [input] */
    limits: Limits;
    /** @returns {number} */
    get totalTokens(): number;
}
