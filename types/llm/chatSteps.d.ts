/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv                CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {ReadStream} [stdin=process.stdin]
 * @returns {Promise<{input:string,inputFile:string|null}>}
 */
export function readInput(argv: string[], fs: FileSystem, stdin?: ReadStream): Promise<{
    input: string;
    inputFile: string | null;
}>;
/**
 * Initialise a {@link Chat} instance (or re‑use an existing one) and
 * persist the current chat ID.
 *
 * The original implementation accepted a single options object.
 * For compatibility with the test suite we also support the legacy
 * positional signature: `initialiseChat(ChatClass, fsInstance)`.
 *
 * @param {object} [input] either the Chat class
 *   itself (positional form) or an options object (named form).
 * @param {typeof Chat} [input.ChatClass] required only when using the positional form.
 * @param {FileSystem} [input.fs] required only when using the positional form.
 * @param {string} [input.root] chat root directory
 * @param {boolean} [input.isNew] additional options when using the positional form.
 * @returns {Promise<{chat: Chat, currentFile: string}>}
 */
export function initialiseChat(input?: {
    ChatClass?: typeof Chat | undefined;
    fs?: FileSystem | undefined;
    root?: string | undefined;
    isNew?: boolean | undefined;
}): Promise<{
    chat: Chat;
    currentFile: string;
}>;
/**
 * Copy the original input file into the chat directory for later reference.
 *
 * @param {string|null} inputFile   absolute path of the source file (or null)
 * @param {string}      input       raw text (used when `inputFile` is null)
 * @param {Chat}        chat
 * @returns {Promise<void>}
 */
export function copyInputToChat(inputFile: string | null, input: string, chat: Chat): Promise<void>;
/**
 * Pack the input into the LLM prompt, store it and return statistics.
 *
 * @param {Function} packMarkdown – function that returns `{text, injected}`
 * @param {string}   input
 * @param {Chat}     chat      – Chat instance (used for `savePrompt`)
 * @returns {Promise<{packedPrompt:string,injected:string[],promptPath:string,stats:any}>}
 */
export function packPrompt(packMarkdown: Function, input: string, chat: Chat): Promise<{
    packedPrompt: string;
    injected: string[];
    promptPath: string;
    stats: any;
}>;
/**
 * Stream the AI response.
 *
 * The function **does not** `await` the stream – the caller decides when
 * to iterate over it.
 *
 * @param {AI} ai
 * @param {string} model
 * @param {Chat} chat
 * @param {import("../llm/AI.js").StreamOptions} options
 * @returns {{stream:AsyncIterable<any>, result:any}}
 */
export function startStreaming(ai: AI, model: string, chat: Chat, options: import("../llm/AI.js").StreamOptions): {
    stream: AsyncIterable<any>;
    result: any;
};
/**
 * Decode the answer markdown and append the test run command.
 * Returns true - if decoded and all tests passed,
 *         false - if decoded and tests fail,
 *         "." | "no" | string - if user did not accept answer and provided details.
 *
 * @param {Chat} chat           – Chat instance (used for paths)
 * @param {(cmd:string, options?: { onData?: (data) => void })=>Promise<{stdout:string,stderr:string,exitCode:number}>} runCommand
 * @param {boolean} [isYes] Is always Yes to user prompts.
 * @returns {Promise<boolean | string>}
 */
export function decodeAnswerAndRunTests(chat: Chat, runCommand: (cmd: string, options?: {
    onData?: (data: any) => void;
}) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>, isYes?: boolean): Promise<boolean | string>;
import FileSystem from "../utils/FileSystem.js";
import { ReadStream } from "node:tty";
import Chat from "./Chat.js";
import AI from "./AI.js";
