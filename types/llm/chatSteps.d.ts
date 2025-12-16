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
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @param {number} [step=1]
 * @returns {Promise<void>}
 */
export function copyInputToChat(inputFile: string | null, input: string, chat: Chat, ui: import("../cli/Ui.js").default, step?: number): Promise<void>;
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
 * @param {Ui} ui User interface instance
 * @returns {Promise<{ packedPrompt: string, injected: string[], promptPath: string, stats: Stats }>}
 */
export function packPrompt(packMarkdown: Function, input: string, chat: Chat, ui: Ui): Promise<{
    packedPrompt: string;
    injected: string[];
    promptPath: string;
    stats: Stats;
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
 * @typedef {Object} TestOutputLogEntry
 * @property {number} i
 * @property {number} no
 * @property {string} str
 *
 * @typedef {Object} TestOutputLogs
 * @property {TestOutputLogEntry[]} fail
 * @property {TestOutputLogEntry[]} cancelled
 * @property {TestOutputLogEntry[]} pass
 * @property {TestOutputLogEntry[]} tests
 * @property {TestOutputLogEntry[]} suites
 * @property {TestOutputLogEntry[]} skip
 * @property {TestOutputLogEntry[]} todo
 * @property {TestOutputLogEntry[]} duration
 * @property {TestOutputLogEntry[]} types
 *
 * @typedef {Object} TestOutputCounts
 * @property {number} fail
 * @property {number} cancelled
 * @property {number} pass
 * @property {number} tests
 * @property {number} suites
 * @property {number} skip
 * @property {number} todo
 * @property {number} duration
 * @property {number} types
 *
 * @typedef {{ logs: TestOutputLogs, counts: TestOutputCounts, types: Set<number> }} TestOutput
 *
 * @param {string} stdout
 * @param {string} stderr
 * @returns {TestOutput}
 */
export function parseOutput(stdout: string, stderr: string): TestOutput;
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
 * @param {Object} param0
 * @param {Ui} param0.ui
 * @param {Chat} param0.chat
 * @param {Function} param0.runCommand
 * @param {number} [param0.step=1]
 * @returns {Promise<import('../cli/runCommand.js').runCommandResult & { parsed: TestOutput }>}
 */
export function runTests({ ui, chat, runCommand, step }: {
    ui: Ui;
    chat: Chat;
    runCommand: Function;
    step?: number | undefined;
}): Promise<import("../cli/runCommand.js").runCommandResult & {
    parsed: TestOutput;
}>;
/**
 * Decode the answer markdown, unpack if confirmed, run tests, parse results,
 * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
 * tests, if they are.
 *
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @param {Chat} chat Chat instance (used for paths)
 * @param {import('../cli/runCommand.js').runCommandFn} runCommand Function to execute shell commands
 * @param {ChatOptions} options Always yes to user prompts
 * @param {number} [step] Optional step number for per-step files
 * @returns {Promise<{testsCode: boolean, shouldContinue: boolean, test: TestOutput}>}
 */
export function decodeAnswerAndRunTests(ui: import("../cli/Ui.js").default, chat: Chat, runCommand: import("../cli/runCommand.js").runCommandFn, options: ChatOptions, step?: number): Promise<{
    testsCode: boolean;
    shouldContinue: boolean;
    test: TestOutput;
}>;
export type TestOutputLogEntry = {
    i: number;
    no: number;
    str: string;
};
export type TestOutputLogs = {
    fail: TestOutputLogEntry[];
    cancelled: TestOutputLogEntry[];
    pass: TestOutputLogEntry[];
    tests: TestOutputLogEntry[];
    suites: TestOutputLogEntry[];
    skip: TestOutputLogEntry[];
    todo: TestOutputLogEntry[];
    duration: TestOutputLogEntry[];
    types: TestOutputLogEntry[];
};
export type TestOutputCounts = {
    fail: number;
    cancelled: number;
    pass: number;
    tests: number;
    suites: number;
    skip: number;
    todo: number;
    duration: number;
    types: number;
};
export type TestOutput = {
    logs: TestOutputLogs;
    counts: TestOutputCounts;
    types: Set<number>;
};
import FileSystem from "../utils/FileSystem.js";
import Ui from "../cli/Ui.js";
import Chat from "./Chat.js";
import { Stats } from 'node:fs';
import AI from "./AI.js";
import ModelInfo from './ModelInfo.js';
import ChatOptions from '../Chat/Options.js';
