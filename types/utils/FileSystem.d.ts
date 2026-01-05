/**
 * @typedef {import('node:fs').Mode | import('node:fs').MakeDirectoryOptions | null} MkDirOptions
 */
/**
 * File system operations wrapper to allow testing
 */
export class FileSystem {
    /**
     * @param {Partial<FileSystem>} [input={}]
     */
    constructor(input?: Partial<FileSystem>);
    /** @type {string} */
    cwd: string;
    /** @type {Map<string, (path: string, encoding: BufferEncoding) => Promise<any>>} */
    loaders: Map<string, (path: string, encoding: BufferEncoding) => Promise<any>>;
    /** @type {Map<string, (path: string, data: any, options: any) => Promise<void>>} */
    savers: Map<string, (path: string, data: any, options: any) => Promise<void>>;
    get path(): Path;
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
     * Load a file – behaviour mirrors the original implementation:
     *   * If the file does **not** exist → `undefined`
     *   * If an extension is registered in `loaders` → use that loader
     *   * Otherwise → plain text read (`utf‑8` by default)
     *
     * @param {string} path
     * @param {BufferEncoding} [encoding='utf-8']
     * @returns {Promise<any|undefined>}
     */
    load(path: string, encoding?: BufferEncoding): Promise<any | undefined>;
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
     * @returns {Promise<Stats>}
     */
    stat(path: string): Promise<Stats>;
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
    /**
     * Read directory contents
     * @param {string} path
     * @param {any} [options]
     * @returns {Promise<string[]>}
     */
    readdir(path: string, options?: any): Promise<string[]>;
    /**
     * Recursively browse a directory.
     * @param {string} path The starting path.
     * @param {object} [options={}]
     * @param {boolean} [options.recursive=false] Whether to browse recursively.
     * @param {string[]} [options.ignore=[]] An array of directory/file patterns to ignore (supports glob patterns).
     * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
     * @param {number} [options.depth=Infinity] Maximum depth to traverse.
     * @returns {Promise<string[]>} A promise that resolves to an array of file/directory paths.
     */
    browse(path: string, options?: {
        recursive?: boolean | undefined;
        ignore?: string[] | undefined;
        onRead?: ((dir: string, entries: string[]) => Promise<void>) | undefined;
        depth?: number | undefined;
    }): Promise<string[]>;
    /**
     * Relative proxy of stat().
     * @param {string} path
     * @returns {Promise<Stats>}
     */
    info(path: string): Promise<Stats>;
    /**
     * JSON loader for .jsonl files.
     * @param {string} path
     * @param {BufferEncoding} [encoding="utf-8"]
     * @returns {Promise<any[]>}
     */
    _jsonlLoader(path: string, encoding?: BufferEncoding): Promise<any[]>;
    /**
     * JSON loader for standard .json files.
     * @param {string} path
     * @param {BufferEncoding} [encoding="utf-8"]
     * @returns {Promise<any>}
     */
    _jsonLoader(path: string, encoding?: BufferEncoding): Promise<any>;
    /**
     * @param {string} path
     * @param {any} rows
     * @param {any} [options]
     * @returns {Promise<void>}
     */
    _jsonlSaver(path: string, rows?: any, options?: any): Promise<void>;
    /**
     * JSON saver – writes a plain JSON file.
     * @param {string} path
     * @param {any} data
     * @param {any} [options]
     * @returns {Promise<void>}
     */
    _jsonSaver(path: string, data?: any, options?: any): Promise<void>;
    /**
     * Relative proxy of mkdir() & writeFile().
     * @param {string} path
     * @param {any} [data]
     * @param {any} [options]
     * @returns {Promise<void>}
     */
    save(path: string, data?: any, options?: any): Promise<void>;
    /**
     * Relative proxy of mkdir() & writeFile(path, data, { flag: "a" }).
     * @param {string} path
     * @param {any} data
     * @param {any} [options]
     * @returns {Promise<void>}
     */
    append(path: string, data: any, options?: any): Promise<void>;
    /**
     * @param {string} prefix
     * @returns {Promise<string>}
     */
    mkdtemp(prefix: string): Promise<string>;
    #private;
}
export type MkDirOptions = import("node:fs").Mode | import("node:fs").MakeDirectoryOptions | null;
import { Path } from './Path.js';
import { Stream } from 'node:stream';
import { Stats } from 'node:fs';
