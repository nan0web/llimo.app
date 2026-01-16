/**
 * @typedef {Object} SendAndStreamOptions
 * @property {string} answer
 * @property {string} reason
 * @property {Usage} usage
 * @property {any[]} unknowns
 * @property {any} [error]
 */
export class ChatCLiApp {
    /** @param {Partial<ChatCLiApp>} props */
    constructor(props: Partial<ChatCLiApp>);
    /** @type {FileSystem} */
    fs: FileSystem;
    /** @type {Git} */
    git: Git;
    /** @type {Ui} */
    ui: Ui;
    /** @type {AI} */
    ai: AI;
    /** @type {ChatOptions} */
    options: ChatOptions;
    /** @type {Chat} */
    chat: Chat;
    /** @type {string} */
    input: string;
    /** @type {string} */
    inputFile: string;
    /**
     * @param {string[]} argv
     * @returns {Promise<boolean>}
     */
    init(argv: string[]): Promise<boolean>;
    /**
     * Run the command before the chat, such as info, test, list.
     * Returns `false` if no need to continue with chat, and `true` if continue.
     * @returns {Promise<boolean>}
     */
    runCommandFirst(): Promise<boolean>;
    initAI(isYes?: boolean): Promise<void>;
    /**
     *
     * @returns {Promise<boolean>}
     */
    readInput(): Promise<boolean>;
    /**
     * Returns True to continue chat and False to stop the chat.
     * @param {string} prompt
     * @param {ModelInfo} model
     * @param {{ content: string, injected: FileSize[] }} packed
     * @param {number} [step=1]
     * @returns {Promise<boolean>}
     */
    prepare(prompt: string, model: ModelInfo, packed: {
        content: string;
        injected: FileSize[];
    }, step?: number): Promise<boolean>;
    /**
     *
     * @param {import("../FileProtocol").ParsedFile} parsed
     * @param {boolean} [isDry=false] If true yields messages without saving files
     * @returns {AsyncGenerator<boolean | string | UiOutput>}
     */
    unpackAnswer(parsed: import("../FileProtocol").ParsedFile, isDry?: boolean): AsyncGenerator<boolean | string | UiOutput>;
    /**
     * @param {number} step
     */
    decodeAnswer(step: number): Promise<{
        answer: string;
        shouldContinue: boolean;
        prompt: string;
    }>;
    /**
     * Decodes the answer and return the next prompt
     * @param {import("../llm/chatLoop.js").sendAndStreamOptions} sent
     * @param {number} [step=1]
     * @returns {Promise<{ answer: string, shouldContinue: boolean, prompt: string }>}
     */
    unpack(sent: import("../llm/chatLoop.js").sendAndStreamOptions, step?: number): Promise<{
        answer: string;
        shouldContinue: boolean;
        prompt: string;
    }>;
    /**
     *
     * @param {string} prompt
     * @param {ModelInfo} model
     * @param {number} [step=1]
     * @returns {Promise<import("../llm/chatLoop.js").sendAndStreamOptions>}
     */
    send(prompt: string, model: ModelInfo, step?: number): Promise<import("../llm/chatLoop.js").sendAndStreamOptions>;
    runTests(step: any): Promise<{
        pass: boolean;
        shouldContinue: boolean;
        test?: undefined;
    } | {
        pass: boolean;
        shouldContinue: boolean;
        test: import("./testing/node.js").SuiteParseResult;
    }>;
    /**
     *
     * @param {number} [step=1]
     * @returns {Promise<{ shouldContinue: boolean, test?: import("./testing/node.js").SuiteParseResult }>}
     */
    test(step?: number): Promise<{
        shouldContinue: boolean;
        test?: import("./testing/node.js").SuiteParseResult;
    }>;
    /**
     * @param {import("./testing/node.js").SuiteParseResult} tested
     * @param {number} [step=1]
     * @returns {Promise<string>} Prompt
     */
    next(tested: import("./testing/node.js").SuiteParseResult, step?: number): Promise<string>;
    /**
     * Packs files into a single markdown string based on a checklist.
     * @param {Object} options
     * @param {string} [options.input] - The markdown string containing the checklist.
     * @param {string} [options.cwd] - The current working directory to resolve files from.
     * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
     * @param {string[]} [options.ignore=[]] An array of directory names to ignore.
     * @returns {AsyncGenerator<string | FileSize | UiOutput>} - The generated markdown string with packed files.
     */
    packMarkdown(options?: {
        input?: string | undefined;
        cwd?: string | undefined;
        onRead?: ((dir: string, entries: string[]) => Promise<void>) | undefined;
        ignore?: string[] | undefined;
    }): AsyncGenerator<string | FileSize | UiOutput>;
    /**
     * Pack the input into the LLM prompt, store it and return statistics.
     *
     * Enhanced to check file modification times and only append new blocks.
     * Updated per @todo: split input (from me.md) into blocks by ---, trim them,
     * filter out blocks that already appear in previous user messages' content,
     * then pack the new blocks. Log all user blocks to inputs.jsonl and injected files to files.jsonl.
     *
     * @param {string} input
     * @returns {Promise<{ content: string, injected: FileSize[] }>}
     */
    packPrompt(input: string): Promise<{
        content: string;
        injected: FileSize[];
    }>;
    /**
     * Copies input data to chat db.
     * @param {number} step
     * @returns {Promise<void>}
     */
    copyInput(step: number): Promise<void>;
    /**
     * Copies input data to chat db.
     * @param {number} step
     * @returns {Promise<void>}
     */
    packSystem(step: number): Promise<void>;
    /**
     * Starts the chat:
     * 1. Detect the recent step
     * 1.1. for Test it should go from the first step
     * 1.2. for Real it should go from the recent step
     * 2. Prepare input (pack prompt with messages)
     * 3. Select a model
     * 3.1. for Test it should be selected from saved log
     * 3.2. for Real it should use available by the algorithm
     * @returns {Promise<{ step: number, prompt: string, model: ModelInfo, packed: { content: string, injected: FileSize[] } }>}
     */
    start(): Promise<{
        step: number;
        prompt: string;
        model: ModelInfo;
        packed: {
            content: string;
            injected: FileSize[];
        };
    }>;
    /**
     * Run communication loop.
     * @returns {Promise<void>}
     */
    loop(): Promise<void>;
    #private;
}
export type SendAndStreamOptions = {
    answer: string;
    reason: string;
    usage: Usage;
    unknowns: any[];
    error?: any;
};
import { FileSystem } from "../utils/index.js";
import { Git } from "../utils/index.js";
import { Ui } from "./Ui.js";
import { AI } from "../llm/index.js";
import { ChatOptions } from "../Chat/index.js";
import { Chat } from "../llm/index.js";
import { ModelInfo } from "../llm/index.js";
import { FileSize } from "../FileProtocol.js";
import { UiOutput } from "./UiOutput.js";
import { Usage } from "../llm/index.js";
