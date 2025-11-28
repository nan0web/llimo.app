/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
/**
 * SummaryCommand – displays a short message in the output to maintain
 * important context in the chat sequence.
 *
 * The command accepts a message in its content:
 *   ```txt
 *   Key changes made:
 *   - Added new utility functions
 *   - Updated test suite
 *   ```
 */
export default class SummaryCommand extends Command {
    static name: string;
    /**
     * @param {Partial<SummaryCommand>} [input={}]
     */
    constructor(input?: Partial<SummaryCommand>);
    run(): AsyncGenerator<string, void, unknown>;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
