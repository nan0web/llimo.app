/**
 * Chat command-line options parser configuration.
 * Defines flags with defaults, aliases, help text.
 */
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
        help: string;
        default: string;
    };
    static model: {
        alias: string;
        help: string;
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
    static ignore: {
        help: string;
        default: string[];
    };
    /**
     * Constructs options instance from partial input.
     * @param {Partial<ChatOptions>} [input] - Partial options.
    */
    static inputFile: {
        help: string;
        stack: string;
        default: string;
    };
    static strategyFinance: {
        alias: string;
        help: string;
        /** @type {"free" | "cheap" | "medium" | "rich"} */
        default: "free" | "cheap" | "medium" | "rich";
    };
    constructor(input?: {});
    /** @type {string[]} Free arguments: text (markdown) file location as input file (pre-prompt) with attachments as markdown - [ignore-rules](location-as-glob) */
    argv: string[];
    /** @type {boolean} Debug mode to show more information */
    isDebug: boolean;
    /** @type {boolean} New chat */
    isNew: boolean;
    /** @type {boolean} Automatically answer yes to all questions */
    isYes: boolean;
    /**
     * @type {boolean} Run in test mode
     * @deprecated Changed with the command test
     */
    isTest: boolean;
    /** @type {boolean} Tiny view in one row that is useful as subtask usage */
    isTiny: boolean;
    /** @type {boolean} Fix the current project (starts with tests) */
    isFix: boolean;
    /**
     * @type {string} Directory for the testing chat with packing/unpacking chat messages
     * @deprecated Moved to the command test
     */
    testDir: string;
    /** @type {string} */
    model: string;
    /** @type {string} Ai provider, use / for subproviders such as huggingface/cerebras */
    provider: string;
    /** @type {number} Maximum number of failed iterations in a row */
    maxFails: number;
    /** @type {boolean} Show help */
    isHelp: boolean;
    /** @type {string[]} Ignored patterns for the injected or listed files */
    ignore: string[];
    /** @type {string} Input file path (relative to cwd) */
    inputFile: string;
    /** @type {"free" | "cheap" | "medium" | "rich"} LLM communication strategy financing: free, cheap, medium, rich */
    strategyFinance: "free" | "cheap" | "medium" | "rich";
}
