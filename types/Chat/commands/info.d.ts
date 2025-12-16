/**
 * Options for the `info` command.
 */
export class InfoOptions {
    static id: {
        help: string;
        default: string;
    };
    constructor(input?: {});
    /** @type {string} */
    id: string;
}
/**
 * `info` command – shows a table with per‑message statistics and a total line.
 *
 * Columns:
 *   - **Role** – system / user / assistant / tool
 *   - **Files** – number of attached files (detected via markdown checklist)
 *   - **Bytes** – raw byte size of the message content
 *   - **Tokens** – estimated token count (≈ 1 token per 4 bytes)
 *
 * After printing the table, the command yields `false` so the CLI code knows it can
 * continue with the normal chat loop.
 */
export class InfoCommand extends UiCommand {
    static name: string;
    static help: string;
    /**
     * @param {object} [input]
     * @param {string[]} [input.argv=[]]
     * @param {Partial<Chat>} [input.chat]
     * @returns {InfoCommand}
     */
    static create(input?: {
        argv?: string[] | undefined;
        chat?: Partial<Chat> | undefined;
    }): InfoCommand;
    constructor(input?: {});
    options: InfoOptions;
    chat: Chat;
    ui: Ui;
    run(): AsyncGenerator<false | Alert | Table, void, unknown>;
    /**
     * @returns {Promise<Table>}
     */
    info(): Promise<Table>;
}
import { UiCommand } from "../../cli/Ui.js";
import Chat from "../../llm/Chat.js";
import { Ui } from "../../cli/Ui.js";
import { Alert } from "../../cli/components/index.js";
import { Table } from "../../cli/components/index.js";
