/**
 * `info` command – shows a table with per‑message statistics,
 * cost and model/provider columns.
 */
export class InfoCommand extends UiCommand {
    static name: string;
    static help: string;
    /**
     * @param {object} [input]
     * @param {string[]} [input.argv=[]]
     * @param {Chat} [input.chat]
     * @returns {InfoCommand}
     */
    static create(input?: {
        argv?: string[] | undefined;
        chat?: Chat | undefined;
    }): InfoCommand;
    /**
     * @param {Partial<InfoCommand>} input
     */
    constructor(input?: Partial<InfoCommand>);
    options: InfoOptions;
    chat: Chat;
    ui: Ui;
    fs: FileSystem;
    /**
     * @throws
     * @returns {AsyncGenerator<UiOutput | boolean>}
     */
    run(): AsyncGenerator<UiOutput | boolean>;
    /**
     * @returns {Promise<Table>}
     */
    info(): Promise<Table>;
}
import { UiCommand } from "../../cli/Ui.js";
/**
 * Options for the `info` command.
 */
declare class InfoOptions {
    static id: {
        help: string;
        default: string;
    };
    constructor(input?: {});
    /** @type {string} */
    id: string;
}
import { Chat } from "../../llm/Chat.js";
import { Ui } from "../../cli/Ui.js";
import { FileSystem } from "../../utils/FileSystem.js";
import { UiOutput } from "../../cli/UiOutput.js";
import { Table } from "../../cli/components/index.js";
export {};
