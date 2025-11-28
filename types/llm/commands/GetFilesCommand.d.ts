/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
/**
 * GetFilesCommand – emits a checklist of files according to a request
 * that appears in the response as a `@get` block.
 *
 * The label part of the markdown reference can contain **minus patterns**
 * separated by semicolons, e.g.:
 *
 *   - [-**\/*.test.js;-**\/*.test.jsx](@get)
 *
 * Positive part (the path inside parentheses) is the base glob.
 * Negative patterns (prefixed with `-`) are applied to filter the result.
 * Default ignore patterns `.git/**` and `node_modules/**` are always applied
 * unless they are explicitly overridden.
 */
export default class GetFilesCommand extends Command {
    static name: string;
    /**
     * Parse a label like `[-**\/*.test.js;-**\/*.test.jsx]` into an array
     * of negative glob patterns.
     *
     * @param {string} label
     * @returns {string[]}
     */
    _negativePatterns(label: string): string[];
    /**
     * Recursively list all files in a directory, respecting ignore patterns
     * @param {string} dir - Directory to scan (absolute path)
     * @param {string[]} ignorePatterns - Patterns to ignore
     * @returns {Promise<string[]>} - Array of relative file paths
     */
    _recursiveList(dir?: string, ignorePatterns?: string[]): Promise<string[]>;
    run(): AsyncGenerator<string, void, unknown>;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
