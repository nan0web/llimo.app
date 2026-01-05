/**
 * Options for the `test` command.
 */
export class TestOptions {
    static id: {
        help: string;
        default: string;
    };
    static testDir: {
        alias: string;
        default: string;
    };
    constructor(input?: {});
    /** @type {string} */
    id: string;
    /** @type {string} */
    testDir: string;
}
/**
 * `test` command – shows a table with per‑message statistics and a total line.
 *
 * Columns:
 *   - **Role** – system / user / assistant / tool
 *   - **Files** – number of attached files (detected via markdown checklist)
 *   - **Bytes** – raw byte size of the message content
 *   - **Tokens** – estimated token count (≈ 1 token per 4 bytes)
 *
 * After printing the table, the command yields `false` so the CLI code knows it can
 * continue with the normal chat loop.
 */
export class TestCommand extends InfoCommand {
    /**
     * @param {object} [input]
     * @param {string[]} [input.argv=[]]
     * @param {Partial<Chat>} [input.chat]
     * @returns {TestCommand}
     */
    static create(input?: {
        argv?: string[] | undefined;
        chat?: Partial<Chat> | undefined;
    }): TestCommand;
    options: TestOptions;
    run(): AsyncGenerator<true | Alert | import("../../cli/index.js").Table | Progress, void, unknown>;
}
import { InfoCommand } from "./info.js";
import { Alert } from "../../cli/index.js";
import { Progress } from "../../cli/index.js";
import { Chat } from "../../llm/Chat.js";
