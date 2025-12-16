/**
 * Handles testing operations for a chat directory: info, unpack simulation, and full test simulation.
 */
export default class TestRunner {
    /**
     * @param {Ui} ui
     * @param {string} chatDir
     * @param {object} options
     */
    constructor(ui: Ui, chatDir: string, options: object);
    /** @type {string} */
    chatDir: string;
    /** @type {object} */
    options: object;
    /** @type {Ui} */
    ui: Ui;
    /** @type {FileSystem} */
    fs: FileSystem;
    /**
     * Run the operation based on mode.
     */
    run(): Promise<void>;
    /**
     * @param {Chat} chat
     */
    showInfo(chat: Chat): Promise<void>;
    simulateUnpack(chat: any): Promise<void>;
    simulateTest(chat: any): Promise<void>;
    /**
     * Locate the N-th user message and delegate to the simulation runner.
     */
    simulateStep(chat: any): Promise<{
        fullResponse: any;
        parsed: import("../FileProtocol.js").ParsedFile;
        simResult: import("ai").StreamTextResult<import("ai").ToolSet, any>;
    }>;
    #private;
}
export type Unit = "byte" | "token";
import Ui from "../cli/Ui.js";
import FileSystem from "../utils/FileSystem.js";
import Chat from "./Chat.js";
