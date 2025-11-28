/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
export default class ListFilesCommand extends Command {
    static name: string;
    run(): AsyncGenerator<string, void, unknown>;
    #private;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
