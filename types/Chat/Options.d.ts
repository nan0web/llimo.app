export default class ChatOptions {
    static argv: {
        help: string;
        default: never[];
    };
    static isDebug: {
        alias: string;
        help: string;
        default: boolean;
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
    static isTiny: {
        alias: string;
        help: string;
        default: boolean;
    };
    static isFix: {
        alias: string;
        help: string;
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
    static isHelp: {
        alias: string;
        help: string;
        default: boolean;
    };
    /** @param {Partial<ChatOptions>} [input] */
    constructor(input?: Partial<ChatOptions>);
    /** @type {string[]} */
    argv: string[];
    /** @type {boolean} */
    isDebug: boolean;
    /** @type {boolean} */
    isNew: boolean;
    /** @type {boolean} */
    isYes: boolean;
    /** @type {boolean} @deprecated Changed with the command test */
    isTest: boolean;
    /** @type {boolean} */
    isTiny: boolean;
    /** @type {boolean} */
    isFix: boolean;
    /** @type {string} @deprecated Moved to the command test */
    testDir: string;
    /** @type {string} */
    model: string;
    /** @type {string} */
    provider: string;
    /** @type {number} */
    maxFails: number;
    /** @type {boolean} */
    isHelp: boolean;
}
