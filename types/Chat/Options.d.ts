export default class ChatOptions {
    static argv: {
        help: string;
        default: never[];
    };
    static isNew: {
        alias: string;
        help: string;
        default: boolean;
    };
    static isYes: {
        help: string;
        alias: string;
        default: boolean;
    };
    static isTest: {
        help: string;
        alias: string;
        default: boolean;
    };
    static testDir: {
        alias: string;
        default: string;
    };
    static model: {
        alias: string;
        default: string;
    };
    static provider: {
        alias: string;
        help: string;
        default: string;
    };
    static maxFails: {
        alias: string;
        help: string;
        default: number;
    };
    /** @param {Partial<ChatOptions>} [input] */
    constructor(input?: Partial<ChatOptions>);
    /** @type {string[]} */
    argv: string[];
    /** @type {boolean} */
    isNew: boolean;
    /** @type {boolean} */
    isYes: boolean;
    /** @type {boolean} @deprecated Changed with the command test */
    isTest: boolean;
    /** @type {string} @deprecated Moved to the command test */
    testDir: string;
    /** @type {string} */
    model: string;
    /** @type {string} */
    provider: string;
    /** @type {number} */
    maxFails: number;
}
