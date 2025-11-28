/** @typedef {{ role: string, content: string | { text: string, type: string } }} ChatMessage */
/**
 * Manages chat history and files
 */
export default class Chat {
    /**
     * @param {Partial<Chat>} [input={}]
     */
    constructor(input?: Partial<Chat>);
    /** @type {string} */
    id: string;
    /** @type {string} */
    cwd: string;
    /** @type {string} */
    root: string;
    /** @type {string} */
    dir: string;
    /** @type {import("ai").ModelMessage[]} */
    messages: import("ai").ModelMessage[];
    /** @returns {FileSystem} */
    get fs(): FileSystem;
    /** @returns {FileSystem} */
    get db(): FileSystem;
    /**
     * Initialize chat directory
     */
    init(): Promise<void>;
    /**
     * Add a message to the history
     * @param {import("ai").ModelMessage} message
     */
    add(message: import("ai").ModelMessage): void;
    /**
     * Returns tokens count for all messages.
     * @returns {number}
     */
    getTokensCount(): number;
    clear(): Promise<void>;
    /**
     * @returns {Promise<boolean>}
     */
    load(): Promise<boolean>;
    save(): Promise<void>;
    /**
     * Save the latest prompt
     * @param {string} prompt
     * @returns {Promise<string>} The prompt path.
     */
    savePrompt(prompt: string): Promise<string>;
    /**
     * Save the AI response
     * @param {string} answer
     */
    saveAnswer(answer: string): Promise<void>;
    #private;
}
export type ChatMessage = {
    role: string;
    content: string | {
        text: string;
        type: string;
    };
};
import FileSystem from "../utils/FileSystem.js";
