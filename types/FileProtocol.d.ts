/**
 * @typedef {Object} ParsedFile
 * @property {FileEntry[]} correct
 * @property {FileError[]} failed
 * @property {boolean} isValid
 * @property {FileEntry | null} validate - Validate content with the list of provided files
 */
export class FileEntry {
    /** @param {Partial<FileEntry>} [input={}] */
    constructor(input?: Partial<FileEntry>);
    /** @type {string} */
    label: string;
    /** @type {string} */
    filename: string;
    /** @type {string} */
    type: string;
    /** @type {string} */
    content: string;
    /** @type {string} */
    encoding: string;
}
export class FileError {
    /** @param {Partial<FileError>} input */
    constructor(input?: Partial<FileError>);
    /** @type {string | Error} */
    error: string | Error;
    /** @type {string} */
    content: string;
    /** @type {number} */
    line: number;
}
export default class FileProtocol {
    /**
     * Validates the correct array of file entries with the `@validate` filename.
     * @param {FileEntry[]} correct
     * @returns {{ isValid: boolean, validate: FileEntry | null }}
     */
    static validate(correct?: FileEntry[]): {
        isValid: boolean;
        validate: FileEntry | null;
    };
    static parse(source: any): Promise<ParsedFile | undefined>;
    /**
     * @param {AsyncGenerator<string>} stream – an async iterator yielding one line per call.
     * @returns {Promise<ParsedFile>}
     */
    static parseStream(stream: AsyncGenerator<string>): Promise<ParsedFile>;
}
export type ParsedFile = {
    correct: FileEntry[];
    failed: FileError[];
    isValid: boolean;
    /**
     * - Validate content with the list of provided files
     */
    validate: FileEntry | null;
};
