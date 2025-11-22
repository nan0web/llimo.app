/**
 * @typedef {import('node:fs').Mode | import('node:fs').MakeDirectoryOptions | null} MkDirOptions
 */
/**
 * File system operations wrapper to allow testing
 */
export default class FileSystem {
    /** @type {Path} */
    path: Path;
    /**
     * Check if file exists
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    access(path: string): Promise<boolean>;
    /**
     * Read file content
     * @param {string} path
     * @param {BufferEncoding} [encoding]
     * @returns {Promise<string>}
     */
    readFile(path: string, encoding?: BufferEncoding): Promise<string>;
    /**
     * Write file content
     * @param {string} path
     * @param {string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | Stream} content
     * @param {Object} [options]
     * @returns {Promise<void>}
     */
    writeFile(path: string, content: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | Stream, options?: any): Promise<void>;
    /**
     * Create directory
     * @param {string} path
     * @param {MkDirOptions} [options]
     * @returns {Promise<string | undefined>}
     */
    mkdir(path: string, options?: MkDirOptions): Promise<string | undefined>;
    /**
     * Get file stats
     * @param {string} path
     * @returns {Promise<Object>}
     */
    stat(path: string): Promise<any>;
    /**
     * Open file handle
     * @param {string} path
     * @returns {Promise<Object>}
     */
    open(path: string): Promise<any>;
    /**
     * Check if path exists and get stats
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    exists(path: string): Promise<boolean>;
    save(path: any, data: any, options: any): Promise<void>;
}
export type MkDirOptions = import("node:fs").Mode | import("node:fs").MakeDirectoryOptions | null;
import Path from './Path.js';
import { Stream } from 'node:stream';
