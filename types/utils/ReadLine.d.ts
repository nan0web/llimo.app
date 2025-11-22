/**
 * @typedef {Object} InteractiveReadLineOptions
 * @property {string}   [stopWord=""]         line that ends the input
 * @property {string[]|string} [stopKeys=[]]  which key‑combos finish the input
 * @property {string}   [question=""]         optional prompt printed before reading
 * @property {boolean}  [help=false]          print the “type # or Ctrl‑Enter” help text
 * @property {NodeJS.ReadableStream} [input]  defaults to process.stdin
 * @property {NodeJS.WritableStream} [output] defaults to process.stdout
 */
/**
 * A thin wrapper around Node's `readline` that supports:
 *   • a “stop word” line,
 *   • configurable key‑combos (Enter / Ctrl‑Enter / Cmd‑Enter),
 *   • optional help text,
 *   • graceful cleanup of raw mode.
 */
export default class ReadLine {
    /**
     * @param {Object} [options] you can override the default stdin/stdout here.
     */
    constructor(options?: any);
    input: any;
    output: any;
    /**
     * Prompt the user and return everything they typed (joined with `\n`).
     *
     * @param {InteractiveReadLineOptions} options
     * @returns {Promise<string>}
     */
    interactive(options?: InteractiveReadLineOptions): Promise<string>;
    /**
     * Helper kept for backward compatibility – just forwards to `readline`
     * @param {import('node:readline').ReadLineOptions} options
     * @returns {Interface}
     */
    createInterface(options: import("node:readline").ReadLineOptions): Interface;
}
export type InteractiveReadLineOptions = {
    /**
     * line that ends the input
     */
    stopWord?: string | undefined;
    /**
     * which key‑combos finish the input
     */
    stopKeys?: string | string[] | undefined;
    /**
     * optional prompt printed before reading
     */
    question?: string | undefined;
    /**
     * print the “type # or Ctrl‑Enter” help text
     */
    help?: boolean | undefined;
    /**
     * defaults to process.stdin
     */
    input?: NodeJS.ReadableStream | undefined;
    /**
     * defaults to process.stdout
     */
    output?: NodeJS.WritableStream | undefined;
};
import { Interface } from 'node:readline';
