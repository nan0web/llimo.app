export default class ChatOptions {
    static argv: {
        default: never[];
    };
    static isNew: {
        alias: string;
        default: boolean;
    };
    static isYes: {
        alias: string;
        default: boolean;
    };
    static testMode: {
        alias: string;
        default: string;
    };
    static testDir: {
        alias: string;
        default: string;
    };
    /** @param {Partial<ChatOptions>} [input] */
    constructor(input?: Partial<ChatOptions>);
    /** @type {string[]} */
    argv: string[];
    /** @type {boolean} */
    isNew: boolean;
    /** @type {boolean} */
    isYes: boolean;
    /** @type {string} */
    testMode: string;
    /** @type {string} */
    testDir: string;
}
