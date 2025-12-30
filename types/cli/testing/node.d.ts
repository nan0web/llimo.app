/**
 * @typedef {Object} TestInfo
 * @property {"todo" | "fail" | "pass" | "cancelled" | "skip" | "types"} type
 * @property {number} no
 * @property {string} text
 * @property {number} indent
 * @property {number} [parent]
 * @property {string} [file]
 * @property {object} [doc]
 * @property {[number, number]} [position]
 *
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
 * @typedef {{ logs: TestOutputLogs, counts: TestOutputCounts, types: Set<number>, tests: TestInfo[], guess: TestOutputCounts }} TestOutput
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {FileSystem} [fs]
 * @returns {TestOutput}
 */
export function parseOutput(stdout: string, stderr: string, fs?: FileSystem): TestOutput;
/**
 * @typedef {Object} TapParseResult
 * @property {string} [version]
 * @property {TestInfo[]} tests
 * @property {Map<number, Error>} errors
 * @property {Map<number, string>} unknowns
 * @property {Map<string, number>} counts
 */
/**
 * TAP parser – extracts test‑level information from raw TAP output.
 */
export class Tap {
    /** @param {Partial<Tap>} input */
    constructor(input: Partial<Tap>);
    /** @type {string[]} */
    rows: string[];
    /** @type {FileSystem} */
    fs: FileSystem;
    /** @type {Map<number, string>} rows that are not part of a TAP test */
    unknowns: Map<number, string>;
    /** @type {Map<number, Error>} parsing errors */
    errors: Map<number, Error>;
    /** @type {Map<string, number>} count of errors by type */
    counts: Map<string, number>;
    /** @type {TestInfo[]} */
    tests: TestInfo[];
    /**
     * Walk through all rows and produce a high‑level summary.
     * @returns {TapParseResult}
     */
    parse(): TapParseResult;
    /**
     * Collects test information from a subtest block.
     *
     * Handles both indented YAML (`---` ...) and non‑indented variants.
     *
     * @param {{ i: number, parent?: number }} input
     * @returns {number} new index (position right after the processed block)
     */
    collectTest(input: {
        i: number;
        parent?: number;
    }): number;
}
export class DeclarationTS extends Tap {
    /**
     *
     * @param {Object} input
     * @param {number} input.i
     * @param {RegExpMatchArray} input.match
     * @returns {number}
     */
    collectTest(input: {
        i: number;
        match: RegExpMatchArray;
    }): number;
}
export class Suite extends Tap {
    /**
     * @returns {TapParseResult & { tap: TapParseResult, ts: TapParseResult }}
     */
    parse(): TapParseResult & {
        tap: TapParseResult;
        ts: TapParseResult;
    };
}
export type TestInfo = {
    type: "todo" | "fail" | "pass" | "cancelled" | "skip" | "types";
    no: number;
    text: string;
    indent: number;
    parent?: number | undefined;
    file?: string | undefined;
    doc?: object;
    position?: [number, number] | undefined;
};
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
    tests: TestInfo[];
    guess: TestOutputCounts;
};
export type TapParseResult = {
    version?: string | undefined;
    tests: TestInfo[];
    errors: Map<number, Error>;
    unknowns: Map<number, string>;
    counts: Map<string, number>;
};
import FileSystem from "../../utils/FileSystem.js";
