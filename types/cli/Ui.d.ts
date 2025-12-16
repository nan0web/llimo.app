/** @typedef {import("./components/Alert.js").AlertVariant | 'log'} LogTarget */
export class UiFormats {
    /**
     * Formats weight (size) of the value, available types:
     * b - bytes
     * T - Tokens
     * @param {"b" | "T"} type
     * @param {number} value
     * @param {(value: number) => string} [format]
     * @returns {string}
     */
    weight(type: "b" | "T", value: number, format?: (value: number) => string): string;
    /**
     * Formats count (amount) of the value
     * @param {number} value
     * @param {(value: number) => string} [format]
     * @returns {string}
     */
    count(value: number, format?: (value: number) => string): string;
    /**
     * @param {number} value
     * @param {number} [digits=2]
     * @returns {string}
     */
    pricing(value: number, digits?: number): string;
}
/**
 * Console wrapper that adds optional file logging and colourised output.
 *
 * @class
 */
export class UiConsole {
    /**
     * @param {Partial<UiConsole>} [options={}]
     */
    constructor(options?: Partial<UiConsole>);
    /** @type {Console} Console implementation to delegate to. */
    console: Console;
    /** @type {boolean} Enable/disable debug output. */
    debugMode: boolean;
    /** @type {string|undefined} Path to a log file; if omitted logging is disabled. */
    logFile: string | undefined;
    /** @type {string} Prefix for .info() */
    prefixedStyle: string;
    /**
     * Append a message to the log file if logging is enabled.
     *
     * @private
     * @param {LogTarget} target
     * @param {string} msg
     */
    private appendFile;
    /**
     * Set's the prefix such as color before every message in .info method.
     * @param {string} prefix
     */
    style(prefix?: string): void;
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
    /**
     * @todo cover with tests.
     * @param {any[][]} rows
     * @param {{divider?: string | number, aligns?: string[]}} [options={}]
     * @returns {string[]}
     */
    table(rows?: any[][], options?: {
        divider?: string | number;
        aligns?: string[];
    }): string[];
}
export class UiCommand {
    /**
     * Creates Alert instance for the Ui output.
     * @param {Partial<Alert>} input
     * @returns {Alert}
     */
    createAlert(input: Partial<Alert>): Alert;
    /**
     * @param {import("./components/Alert.js").AlertVariant} [variant='info']
     * @returns {(input: Partial<Alert>) => Alert}
     */
    createAlerter(variant?: import("./components/Alert.js").AlertVariant): (input: Partial<Alert>) => Alert;
    /**
     * Creates Table instance for the Ui output.
     * @param {Partial<Table>} input
     * @returns {Table}
     */
    createTable(input: Partial<Table>): Table;
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
    /** @type {UiFormats} UiFormats instance to format numbers, if omitted new UiFormats() is used. */
    formats: UiFormats;
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
export type LogTarget = import("./components/Alert.js").AlertVariant | "log";
import Alert from "./components/Alert.js";
import Table from "./components/Table.js";
