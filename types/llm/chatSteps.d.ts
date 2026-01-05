/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {Ui} ui User interface instance, used for input (stdin) stream only.
 * @returns {Promise<{input: string, inputFile: string | null}>}
 */
export function readInput(argv: string[], fs: FileSystem, ui: Ui): Promise<{
    input: string;
    inputFile: string | null;
}>;
/**
 * Initialise a {@link Chat} instance (or re‑use an existing one) and
 * persist the current chat ID.
 *
 * @param {object} input either the Chat class itself (positional form) or an options object (named form).
 * @param {typeof Chat} [input.ChatClass] required only when using the positional form.
 * @param {FileSystem} [input.fs] required only when using the positional form.
 * @param {string} [input.root] chat root directory
 * @param {boolean} [input.isNew] additional options when using the positional form.
 * @param {Ui} input.ui User interface instance
 * @returns {Promise<{chat: Chat, currentFile: string}>}
 */
export function initialiseChat(input: {
    ChatClass?: typeof Chat | undefined;
    fs?: FileSystem | undefined;
    root?: string | undefined;
    isNew?: boolean | undefined;
    ui: Ui;
}): Promise<{
    chat: Chat;
    currentFile: string;
}>;
/**
 * Copy the original input file into the chat directory for later reference.
 *
 * @param {string|null} inputFile absolute path of the source file (or null)
 * @param {string} input raw text (used when `inputFile` is null)
 * @param {Chat} chat Chat instance (used for paths)
 * @param {import("../cli/Ui.js").Ui} ui User interface instance
 * @param {number} [step=1]
 * @returns {Promise<void>}
 */
export function copyInputToChat(inputFile: string | null, input: string, chat: Chat, ui: import("../cli/Ui.js").Ui, step?: number): Promise<void>;
/**
 * Pack the input into the LLM prompt, store it and return statistics.
 *
 * Enhanced to check file modification times and only append new blocks.
 * Updated per @todo: split input (from me.md) into blocks by ---, trim them,
 * filter out blocks that already appear in previous user messages' content,
 * then pack the new blocks. Log all user blocks to inputs.jsonl and injected files to files.jsonl.
 *
 * @param {Function} packMarkdown function that returns `{text, injected}`
 * @param {string} input
 * @param {Chat} chat Chat instance (used for `savePrompt`)
 * @returns {Promise<{ packedPrompt: string, injected: string[] }>}
 */
export function packPrompt(packMarkdown: Function, input: string, chat: Chat): Promise<{
    packedPrompt: string;
    injected: string[];
}>;
/**
 * Stream the AI response.
 *
 * The function **does not** `await` the stream – the caller decides when
 * to iterate over it.
 *
 * @param {AI} ai
 * @param {ModelInfo} model
 * @param {Chat} chat
 * @param {object} options Stream options
 * @returns {{stream: AsyncIterable<any>, result: any}}
 */
export function startStreaming(ai: AI, model: ModelInfo, chat: Chat, options: object): {
    stream: AsyncIterable<any>;
    result: any;
};
/**
 * Decodes the answer and return the next prompt
 * @param {Object} param0
 * @param {Ui} param0.ui
 * @param {Chat} param0.chat
 * @param {ChatOptions} param0.options
 * @param {string[]} [param0.logs=[]]
 * @returns {Promise<{ answer: string, shouldContinue: boolean, logs: string[], prompt: string }>}
 */
export function decodeAnswer({ ui, chat, options, logs }: {
    ui: Ui;
    chat: Chat;
    options: ChatOptions;
    logs?: string[] | undefined;
}): Promise<{
    answer: string;
    shouldContinue: boolean;
    logs: string[];
    prompt: string;
}>;
/**
 *
 * @param {import('../cli/testing/node.js').TestInfo[]} tests
 * @param {Ui} ui
 * @returns {any[][]}
 */
export function renderTests(tests: import("../cli/testing/node.js").TestInfo[], ui?: Ui): any[][];
/**
 *
 * @param {Object} input
 * @param {Ui} input.ui
 * @param {"fail" | "skip" | "todo"} [input.type]
 * @param {import('../cli/testing/node.js').TestInfo[]} [input.tests=[]]
 * @param {string[]} [input.content=[]]
 * @returns {Promise<boolean>}
 */
export function printAnswer(input: {
    ui: Ui;
    type?: "todo" | "skip" | "fail" | undefined;
    tests?: import("../cli/testing/node.js").TestInfo[] | undefined;
    content?: string[] | undefined;
}): Promise<boolean>;
/**
 * Decode the answer markdown, unpack if confirmed, run tests, parse results,
 * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
 * tests, if they are.
 *
 * @param {Object} input
 * @param {import("../cli/Ui.js").Ui} input.ui User interface instance
 * @param {FileSystem} [input.fs]
 * @param {Chat} input.chat Chat instance (used for paths)
 * @param {import('../cli/runCommand.js').runCommandFn} input.runCommand Function to execute shell commands
 * @param {ChatOptions} input.options Always yes to user prompts
 * @param {number} [input.step] Optional step number for per-step files
 * @returns {Promise<{pass?: boolean, shouldContinue: boolean, test?: import('../cli/testing/node.js').TapParseResult}>}
 */
export function decodeAnswerAndRunTests(input: {
    ui: import("../cli/Ui.js").Ui;
    fs?: FileSystem | undefined;
    chat: Chat;
    runCommand: import("../cli/runCommand.js").runCommandFn;
    options: ChatOptions;
    step?: number | undefined;
}): Promise<{
    pass?: boolean;
    shouldContinue: boolean;
    test?: import("../cli/testing/node.js").TapParseResult;
}>;
/**
 * @typedef {Object} runTestsResult
 * @property {boolean} pass
 * @property {boolean} shouldContinue
 * @property {import("../cli/testing/node.js").SuiteParseResult} [test]
 *
 * @param {Object} input
 * @param {Ui} input.ui
 * @param {FileSystem} input.fs
 * @param {Chat} input.chat
 * @param {import("../cli/runCommand.js").runCommandFn} input.runCommand
 * @param {number} [input.step=1]
 * @param {string[]} [input.logs=[]]
 * @param {object} [input.options={}]
 * @returns {Promise<runTestsResult>}
 */
export function runTests(input: {
    ui: Ui;
    fs: FileSystem;
    chat: Chat;
    runCommand: import("../cli/runCommand.js").runCommandFn;
    step?: number | undefined;
    logs?: string[] | undefined;
    options?: object;
}): Promise<runTestsResult>;
export type runTestsResult = {
    pass: boolean;
    shouldContinue: boolean;
    test?: import("../cli/testing/node.js").SuiteParseResult | undefined;
};
import { FileSystem } from "../utils/FileSystem.js";
import { Ui } from "../cli/Ui.js";
import { Chat } from "./Chat.js";
import { AI } from "./AI.js";
import { ModelInfo } from './ModelInfo.js';
import ChatOptions from '../Chat/Options.js';
