/** @typedef {"success" | "info" | "warn" | "error" | "debug" | "log"} LogTarget */
/**
 * @typedef {Object} ProgressFnInput
 * @property {number} elapsed elapsed seconds
 * @property {number} startTime start timestamp ms
 */
export class UiStyle {
    /**
     * @param {Partial<UiStyle>} input
     */
    constructor(input?: Partial<UiStyle>);
    /** @type {number} */
    paddingLeft: number;
}
/** @typedef {"b" | "f" | "T"} UiWeightType */
export class UiFormats {
    /**
     * Formats weight (size) of the value, available types:
     * b - bytes
     * f - files
     * T - Tokens
     * @param {UiWeightType} type
     * @param {number} value
     * @param {(value: number) => string} [format]
     * @returns {string}
     */
    weight(type: UiWeightType, value: number, format?: (value: number) => string): string;
    /**
     * Formats count (amount) of the value
     * @param {number} value
     * @param {(value: number) => string} [format]
     * @returns {string}
     */
    count(value: number, format?: (value: number) => string): string;
    /**
     * @param {number} value
     * @param {number} [digits=4]
     * @returns {string}
     */
    pricing(value: number, digits?: number): string;
    /**
     * Formats money in USD with currency symbol and six decimals by default.
     * Delegates to pricing to keep consistent formatting.
     * @param {number} value
     * @param {number} [digits=4]
     * @returns {string}
     */
    money(value: number, digits?: number): string;
    /**
     * Formats timer elapsed in mm:ss.s format, caps at 3600s+.
     * @param {number} elapsed - Milliseconds elapsed.
     * @returns {string}
     */
    timer(elapsed: number): string;
    /**
     * Returns a colored used count of TOTAL.
     * @param {number} count
     * @param {number} total
     * @param {UiWeightType} [type="T"]
     * @returns {string}
     */
    used(count: number, total: number, type?: UiWeightType): string;
}
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
    stdout: NodeJS.WriteStream & {
        fd: 1;
    };
    /**
     * Append a message to the log file if logging is enabled.
     *
     * @param {LogTarget} target
     * @param {string} msg
     */
    appendFile(target: LogTarget, msg: string): void;
    /**
     * Set's the prefix such such as color before every message in .info method.
     * @param {string} prefix
     */
    style(prefix?: string): void;
    /**
     * @todo write jsdoc
     * @param {any[]} args
     * @returns {{ styles: UiStyle[], args: string[] }}
     */
    extractStyles(args?: any[]): {
        styles: UiStyle[];
        args: string[];
    };
    /**
     * @todo write jsdoc
     * @param {any[]} args
     * @returns {string}
     */
    extractMessage(args?: any[]): string;
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
     * @todo write jsdoc
     * @param {string} line
     * @param {string} [space=" "]
     * @param {string} [more="…"]
     * @returns {string}
     */
    full(line: string, space?: string, more?: string): string;
    /**
     * @todo write jsdoc
     * @param {string} line
     * @param {string} [space=" "]
     * @param {string} [more="…"]
     * @returns {string}
     */
    clear(line: string, space?: string, more?: string): string;
    /**
     * Progress bar string.
     * @param {number} value Progress value from 0 to 1
     * @param {number} [width=33]
     * @param {string} [on="="]
     * @param {string} [off=" "]
     * @returns {string}
     */
    bar(value: number, width?: number, on?: string, off?: string): string;
    /**
     * @todo cover with tests.
     * @param {any[][]} rows
     * @param {Partial<TableOptions>} [options={}]
     * @returns {string[]}
     */
    table(rows?: any[][], options?: Partial<TableOptions>): string[];
    /**
     * Clears the frame to collect the output before the stopFrame().
     */
    startFrame(): void;
    /**
     * Returns collected output from latests startFrane().
     * @returns {string}
     */
    stopFrame(): string;
    #private;
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
    /** @type {string[]} */
    progressFrame: string[];
    /** @type {UiFormats} UiFormats instance to format numbers, if omitted new UiFormats() is used. */
    formats: UiFormats;
    /** @type {string[]} Queue of predefined stdin values (if STDIN env var is set). */
    definedInputs: string[];
    /** @type {readline.Interface|undefined} */
    _rl: readline.Interface | undefined;
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
     * @param {number | string} [lines=1] The lines to clear or string as a frame to
     *                                    clear the number of new lines inside the
     *                                    current window frame getWindowSize().
     * @returns {number} The number of lines cleared up.
     */
    cursorUp(lines?: number | string): number;
    /**
     * Overwrite the current line with the given text.
     *
     * @param {string} line
     */
    overwriteLine(line: string): void;
    /**
     * Progress bar helper.
     *
     * @param {number} value Progress value from 0 to 1
     * @param {number} [width=33]
     * @param {string} [on="="]
     * @param {string} [off=" "]
     * @returns {string}
     */
    bar(value: number, width?: number, on?: string, off?: string): string;
    /**
     * Writes to stdout.
     * @param {Buffer | DataView | Error | string} buffer
     * @param {(err?: Error | null | undefined) => void} [cb]
     */
    write(buffer: Buffer | DataView | Error | string, cb?: (err?: Error | null | undefined) => void): void;
    /**
     * Prompt the user with a question and resolve with the answer.
     *
     * If predefined STDIN values are supplied via the STDIN environment variable,
     * the next value from that queue is returned without asking the user.
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
     * @param {(input: ProgressFnInput) => void} fn
     * @param {number} [startTime]
     * @param {number} [fps]
     * @returns {NodeJS.Timeout}
     */
    createProgress(fn: (input: ProgressFnInput) => void, startTime?: number, fps?: number): NodeJS.Timeout;
    /**
     * @todo write jsdoc
     * @param {Object} options
     * @param {number} [options.paddingLeft]
     * @returns {UiStyle}
     */
    createStyle(options?: {
        paddingLeft?: number | undefined;
    }): UiStyle;
    /**
     * Renders element into string and outputs if returnOnly is omitted or false.
     * @param {string | any[] | UiOutput} element
     * @param {*} returnOnly
     * @returns {string}
     */
    render(element: string | any[] | UiOutput, returnOnly?: any): string;
}
export type LogTarget = "success" | "info" | "warn" | "error" | "debug" | "log";
export type ProgressFnInput = {
    /**
     * elapsed seconds
     */
    elapsed: number;
    /**
     * start timestamp ms
     */
    startTime: number;
};
export type UiWeightType = "b" | "f" | "T";
import { TableOptions } from "./components/Table.js";
import { Alert } from "./components/index.js";
import { Table } from "./components/index.js";
import readline from "node:readline";
import { UiOutput } from "./UiOutput.js";
