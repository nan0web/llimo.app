export default class JSONL {
    /**
     * @param {AsyncGenerator<string>} stream – an async iterator yielding one line per call.
     * @returns {Promise<ParsedFile>}
     */
    static parseStream(stream: AsyncGenerator<string>): Promise<ParsedFile>;
}
export type ParsedFile = import("../FileProtocol.js").ParsedFile;
