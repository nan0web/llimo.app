export * from "./utils/ANSI.js";
/**
 * Formats milliseconds into a mm:ss.s string.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted time string.
 */
export function formatTime(ms: number): string;
/**
 * Clears the console line to prepare for a new progress update.
 * @param {WriteStream} [stdout=process.stdout]
 */
export function clearLine(stdout?: WriteStream): void;
/**
 * Finds configuration files in current or parent directories.
 * @param {string[]} filenames - Array of filenames to search for.
 * @param {FileSystem} [fileSystem=defaultFileSystem] - FileSystem instance for testing
 * @param {Path} [pathUtil=defaultPath] - Path instance for testing
 * @returns {Promise<Array<{path: string, content: string}>>} Array of found files with their paths and contents.
 */
export function findConfigFiles(filenames: string[], fileSystem?: FileSystem, pathUtil?: Path): Promise<Array<{
    path: string;
    content: string;
}>>;
/**
 * Gets the prompt from a file, stdin, or interactive input.
 * @param {string} promptFile - The file to read the prompt from.
 * @param {FileSystem} [fileSystem=defaultFileSystem] - FileSystem instance for testing
 * @param {ReadLine} [readLine=defaultReadLine] - ReadLine instance for testing
 * @param {ReadStream} [stdin] - Mock stdin object for testing
 * @returns {Promise<string>} The prompt text.
 */
export function getPrompt(promptFile: string, fileSystem?: FileSystem, readLine?: ReadLine, stdin?: ReadStream): Promise<string>;
/**
 * @param {string} str
 * @returns {string}
 */
export function normalizeJSONL(str: string): string;
/**
 * @param {string} str
 * @returns {Array<any | Error>}
 */
export function parseJSONL(str: string): Array<any | Error>;
import FileSystem from './utils/FileSystem.js';
import Path from './utils/Path.js';
import ReadLine from './utils/ReadLine.js';
import { WriteStream } from 'node:tty';
import { ReadStream } from 'node:tty';
export { FileSystem, Path, ReadLine };
