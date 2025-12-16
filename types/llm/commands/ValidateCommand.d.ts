/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
export default class ValidateCommand extends Command {
    static name: string;
    /**
     * @param {Partial<ValidateCommand>} [input={}]
     */
    constructor(input?: Partial<ValidateCommand>);
    /**
     * @returns {AsyncGenerator<string | Alert>}
     */
    run(): AsyncGenerator<string | Alert>;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
import { Alert } from "../../cli/components/index.js";
