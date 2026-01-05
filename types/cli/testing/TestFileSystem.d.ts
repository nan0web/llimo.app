/**
 * Mock FileSystem for testing purposes.
 * Stores all data in memory without accessing the real filesystem.
 */
export class TestFileSystem extends FileSystem {
    /**
     * @param {Partial<FileSystem> & { data?: [string, any][] | Map<string, any> }} input
     */
    constructor(input?: Partial<FileSystem> & {
        data?: [string, any][] | Map<string, any>;
    });
    /**
     * Get all stored data.
     * @returns {Map<string, any>}
     */
    getData(): Map<string, any>;
    /**
     * Get operation logs.
     * @returns {string[]}
     */
    getLogs(): string[];
    /**
     * Clear all data and logs.
     */
    clear(): void;
    /**
     * @param {string} path
     * @param {any} data
     * @param {any} [options]
     * @returns {Promise<void>}
     */
    save(path: string, data: any, options?: any): Promise<void>;
    /**
     * @param {string} path
     * @returns {Promise<void>}
     */
    append(path: string, data: any, options: any): Promise<void>;
    /**
     * @param {string} path
     * @param {object} [options]
     * @returns {Promise<string[]>}
     */
    browse(path: string, options?: object): Promise<string[]>;
    #private;
}
import { FileSystem } from "../../utils/FileSystem.js";
