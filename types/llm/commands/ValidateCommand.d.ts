/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
export default class ValidateCommand extends Command {
    static name: string;
    /**
     * @param {Partial<ValidateCommand>} [input={}]
     */
    constructor(input?: Partial<ValidateCommand>);
    run(): AsyncGenerator<string, void, unknown>;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
