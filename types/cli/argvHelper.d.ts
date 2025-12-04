/**
 * Shared logic for parsing command‑line arguments and optional STDIN data.
 *
 * Both `llimo-pack.js` and `llimo-unpack.js` need identical behaviour:
 *  - If STDIN is not a TTY, treat the incoming data as the markdown source.
 *  - If STDIN is empty, interpret `argv[0]` as an input markdown file and
 *    optionally `argv[1]` as an output destination.
 *  - When only an output destination is supplied (no input file), fall back to
 *    an interactive readline (the same as the original scripts).
 *
 * The function returns an object containing:
 *   - `mdStream`: a readline Interface that yields markdown lines, or `null`
 *   - `outputPath`: absolute path where the result should be written (or `undefined`)
 *   - `baseDir`: directory used to resolve relative file paths (defaults to cwd)
 *
 * @param {string[]} argv   Command‑line arguments (already sliced).
 * @param {string} stdinData Raw data read from stdin (empty string if none).
 * @returns {Promise<{mdStream: import('readline').Interface|null, outputPath?: string, baseDir: string}>}
 */
export function parseIO(argv: string[], stdinData: string): Promise<{
    mdStream: import("readline").Interface | null;
    outputPath?: string;
    baseDir: string;
}>;
/**
 * Simple argument parser – returns an **instance** of the provided Model.
 *
 * @template T extends object
 * @param {string[]} argv - Raw arguments (process.argv.slice(2))
 * @param {new (...args:any)=>T} Model - Class whose static properties describe options.
 * @returns {T}
 */
export function parseArgv<T>(argv: string[], Model: new (...args: any) => T): T;
