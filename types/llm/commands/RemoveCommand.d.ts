/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */
/**
 * RemoveCommand – removes files from the project (cwd).
 *
 * The command accepts file paths (one per line) in its content:
 *   ```txt
 *   dist/build.js
 *   temp/cache.tmp
 *   ```
 */
export default class RemoveCommand extends Command {
    static name: string;
    /**
     * @param {Partial<RemoveCommand>} [input={}]
     */
    constructor(input?: Partial<RemoveCommand>);
    run(): AsyncGenerator<string, void, unknown>;
}
export type ParsedFile = import("../../FileProtocol.js").ParsedFile;
import Command from "./Command.js";
