export default class Command extends UiCommand {
    static help: string;
    static label: string;
    static example: string;
    /**
     * @param {Partial<Command>} input
     */
    constructor(input?: Partial<Command>);
    /** @type {string} */
    cwd: string;
    /** @type {FileSystem} */
    fs: FileSystem;
    /** @type {number} */
    timeout: number;
    /** @type {FileEntry} */
    file: FileEntry;
    /** @type {import("../../FileProtocol.js").ParsedFile} */
    parsed: import("../../FileProtocol.js").ParsedFile;
    /**
     * @returns {AsyncGenerator<string | Alert | Table>}
     */
    run(): AsyncGenerator<string | Alert | Table>;
}
import { UiCommand } from "../../cli/Ui.js";
import FileSystem from "../../utils/FileSystem.js";
import { FileEntry } from "../../FileProtocol.js";
import { Alert } from "../../cli/components/index.js";
import { Table } from "../../cli/components/index.js";
