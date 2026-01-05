/** @typedef {import("../FileProtocol.js").ParsedFile} ParsedFile */
/**
 * MarkdownProtocol – parses markdown with file blocks into a structured format.
 */
export class MarkdownProtocol extends FileProtocol {
    /**
     * Process a single line of markdown input.
     * @param {string} rawLine - The raw line to process
     * @param {number} i - Current line number
     * @param {FileEntry | null} current - Current file entry being processed
     * @param {string | null} innerType - Current inner code block type
     * @param {number} started - Line number where current file started
     * @returns {{ nextCurrent: FileEntry | null, nextInnerType: string | null, nextStarted: number, entry: FileEntry | null }}
     */
    static _processLine(rawLine: string, i: number, current: FileEntry | null, innerType: string | null, started: number): {
        nextCurrent: FileEntry | null;
        nextInnerType: string | null;
        nextStarted: number;
        entry: FileEntry | null;
    };
    /**
     * Parse the source into ParsedFile.
     * @param {string} source – a source of content
     * @returns {Promise<ParsedFile>}
     */
    static parse(source: string): Promise<ParsedFile>;
    /**
     * Parse a markdown checklist line and extract the file path if it matches the pattern.
     *
     * Supported patterns (case‑insensitive, optional spaces):
     *   - [<name?>](<path>)
     *
     * @param {string} line
     * @returns {{ name: string, path: string }|null} – relative path and name, or null if the line does not match.
     */
    static extractPath(line: string): {
        name: string;
        path: string;
    } | null;
}
export type ParsedFile = import("../FileProtocol.js").ParsedFile;
import { FileProtocol } from "../FileProtocol.js";
import { FileEntry } from "../FileProtocol.js";
