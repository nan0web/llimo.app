/**
 * @typedef {'debug'|'info'|'log'|'warn'|'error'|'success'} LogTarget
 */
/**
 * Console wrapper that adds optional file logging and colourised output.
 *
 * @class
 */
export class UiConsole {
    /**
     * @param {Object} [options={}]
     * @param {Console} [options.uiConsole=console] - Console implementation to delegate to.
     * @param {boolean} [options.debugMode=false] - Enable/disable debug output.
     * @param {string} [options.logFile] - Path to a log file; if omitted logging is disabled.
     */
    constructor(options?: {
        uiConsole?: Console | undefined;
        debugMode?: boolean | undefined;
        logFile?: string | undefined;
    });
    /** @type {Console} */
    console: Console;
    /** @type {boolean} */
    debugMode: boolean;
    /** @type {string|undefined} */
    logFile: string | undefined;
    /**
     * Append a message to the log file if logging is enabled.
     *
     * @private
     * @param {LogTarget} target
     * @param {string} msg
     */
    private appendFile;
    /**
     * Output a debug message when debug mode is enabled.
     *
     * @param {...any} args
     */
    debug(...args: any[]): void;
    /** @param {...any} args */
    info(...args: any[]): void;
    /** @param {...any} args */
    log(...args: any[]): void;
    /** @param {...any} args */
    warn(...args: any[]): void;
    /** @param {...any} args */
    error(...args: any[]): void;
    /** @param {...any} args */
    success(...args: any[]): void;
}
/**
 * UI helper for CLI interactions.
 *
 * @class
 */
export class Ui {
    /**
     * @param {Partial<Ui>} [options={}]
     */
    constructor(options?: Partial<Ui>);
    /** @type {boolean} */
    debugMode: boolean;
    /** @type {string|null} */
    logFile: string | null;
    /** @type {NodeJS.ReadStream} */
    stdin: NodeJS.ReadStream;
    /** @type {NodeJS.WriteStream} */
    stdout: NodeJS.WriteStream;
    /** @type {NodeJS.WriteStream} */
    stderr: NodeJS.WriteStream;
    /** @type {UiConsole} */
    console: UiConsole;
    /**
     * Get debug mode status.
     *
     * @returns {boolean}
     */
    get isDebug(): boolean;
    /**
     * Set debug mode and optionally specify a log file.
     *
     * @param {boolean} debug
     * @param {string|null} [logFile=null]
     */
    setup(debug?: boolean, logFile?: string | null): void;
    /**
     * Move the cursor up by a number of lines.
     *
     * @param {number} [lines=1]
     */
    cursorUp(lines?: number): void;
    /**
     * Overwrite the current line with the given text.
     *
     * @param {string} line
     */
    overwriteLine(line: string): void;
    write(buffer: any, cb: any): void;
    /**
     * Prompt the user with a question and resolve with the answer.
     *
     * @param {string} question
     * @returns {Promise<string>}
     */
    ask(question: string): Promise<string>;
    /**
     * Prompt a yes/no question.
     *
     * Returns `"yes"` for an affirmative answer, `"no"` for a negative answer,
     * and the raw answer string if it does not match those expectations.
     *
     * @param {string} question
     * @returns {Promise<"yes" | "no" | string>}
     */
    askYesNo(question: string): Promise<"yes" | "no" | string>;
    /**
     * Create progress interval to call the fn() with provided fps.
     *
     * @typedef {Object} ProgressFnInput
     * @property {number} elapsed
     * @property {number} startTime
     *
     * @param {(input: ProgressFnInput) => void} fn
     * @param {number} [startTime]
     * @param {number} [fps]
     * @returns {NodeJS.Timeout}
     */
    createProgress(fn: (input: {
        elapsed: number;
        startTime: number;
    }) => void, startTime?: number, fps?: number): NodeJS.Timeout;
}
export default Ui;
export type LogTarget = "debug" | "info" | "log" | "warn" | "error" | "success";
