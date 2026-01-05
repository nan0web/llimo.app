/**
 * @typedef {Object} ParsedFile
 * @property {FileEntry[]} [correct=[]] List of correctly parsed files from the response
 * @property {FileError[]} [failed=[]] List of errors per line detected in the response
 * @property {boolean} [isValid=false] Validation flag that checked by LLiMo validate files compared to delivered files in the response
 * @property {FileEntry | null} [validate=null] Validate content with the list of provided files
 * @property {Map<string, string>} [files=new Map()] Map<filename, label> of found files in LLiMo response in [label, filename] format
 * @property {Map<string, string>} [requested=new Map()] Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
 */
/**
 * @typedef {Object} ValidateResult
 * @property {boolean} [isValid=false] Validation flag that checked by LLiMo validate files compared to delivered files in the response
 * @property {FileEntry | null} [validate=null] Validate file with the content of the listed files that LLiMo thinks must be delivered in the response
 * @property {Map<string, string>} [files=new Map()] Map<filename, label> of found files in LLiMo response in [label, filename] format
 * @property {Map<string, string>} [requested=new Map()] Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
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
export class FileProtocol {
    /**
     * Validates the correct array of file entries with the `@validate` filename.
     * @param {FileEntry[]} correct
     * @returns {ValidateResult}
     */
    static validate(correct?: FileEntry[]): ValidateResult;
    /**
     * Parse the source into ParsedFile.
     * @param {any} source – a source of content
     * @returns {Promise<ParsedFile>}
     */
    static parse(source: any): Promise<ParsedFile>;
    /**
     * @param {AsyncGenerator<string> | import("node:readline").Interface} stream – an async iterator yielding one line per call.
     * @returns {Promise<ParsedFile>}
     */
    static parseStream(stream: AsyncGenerator<string> | import("node:readline").Interface): Promise<ParsedFile>;
}
export type ParsedFile = {
    /**
     * List of correctly parsed files from the response
     */
    correct?: FileEntry[] | undefined;
    /**
     * List of errors per line detected in the response
     */
    failed?: FileError[] | undefined;
    /**
     * Validation flag that checked by LLiMo validate files compared to delivered files in the response
     */
    isValid?: boolean | undefined;
    /**
     * Validate content with the list of provided files
     */
    validate?: FileEntry | null | undefined;
    /**
     * Map<filename, label> of found files in LLiMo response in [label, filename] format
     */
    files?: Map<string, string> | undefined;
    /**
     * Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
     */
    requested?: Map<string, string> | undefined;
};
export type ValidateResult = {
    /**
     * Validation flag that checked by LLiMo validate files compared to delivered files in the response
     */
    isValid?: boolean | undefined;
    /**
     * Validate file with the content of the listed files that LLiMo thinks must be delivered in the response
     */
    validate?: FileEntry | null | undefined;
    /**
     * Map<filename, label> of found files in LLiMo response in [label, filename] format
     */
    files?: Map<string, string> | undefined;
    /**
     * Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
     */
    requested?: Map<string, string> | undefined;
};
