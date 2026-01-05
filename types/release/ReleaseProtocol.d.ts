/**
 * ReleaseProtocol – parses release‑notes markdown into a concise JSON structure.
 *
 * Expected markdown shape:
 *   # <title>
 *
 *   1. [<label>](<link>)
 *      <description text …>
 *
 *   (repeated for each task)
 *
 * The parser extracts:
 *   - `title` – the first level‑1 heading.
 *   - `tasks` – an array of objects `{ label: string, link: string, text: string }`.
 */
export default class ReleaseProtocol extends FileProtocol {
    /**
     * Parse a release‑notes markdown source.
     *
     * @param {string} source – markdown content of a release file.
     * @returns {Promise<import("../FileProtocol.js").ParsedFile & { title: string, tasks: Array<{label:string, link:string, text:string}> }>}
     */
    static parse(source: string): Promise<import("../FileProtocol.js").ParsedFile & {
        title: string;
        tasks: Array<{
            label: string;
            link: string;
            text: string;
        }>;
    }>;
    /**
     * Parse from stream.
     * @param {AsyncGenerator<string> | import("node:readline").Interface} stream
     * @returns {Promise<import("../FileProtocol.js").ParsedFile & { title: string, tasks: Array<{label:string, link:string, text:string}> }>}
     */
    static parseStream(stream: AsyncGenerator<string> | import("node:readline").Interface): Promise<import("../FileProtocol.js").ParsedFile & {
        title: string;
        tasks: Array<{
            label: string;
            link: string;
            text: string;
        }>;
    }>;
}
import { FileProtocol } from "../FileProtocol.js";
