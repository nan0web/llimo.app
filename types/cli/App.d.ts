export class ChatCLiApp {
    /** @param {Partial<ChatCLiApp>} props */
    constructor(props: Partial<ChatCLiApp>);
    /** @type {FileSystem} */
    fs: FileSystem;
    /** @type {Git} */
    git: Git;
    /** @type {Ui} */
    ui: Ui;
    /** @type {AI} */
    ai: AI;
    /** @type {ChatOptions} */
    options: ChatOptions;
    /** @type {Chat} */
    chat: Chat;
    /** @type {string} */
    input: string;
    /** @type {string} */
    inputFile: string;
    init(input: any): Promise<boolean>;
    /**
     * Run the command before the chat, such as info, test.
     * Returns `false` if no need to continue with chat, and `true` if continue.
     * @param {string[]} input
     * @returns {Promise<boolean>}
     */
    runCommandFirst(input: string[]): Promise<boolean>;
    initAI(isYes?: boolean): Promise<void>;
    /**
     *
     * @returns {Promise<boolean>}
     */
    readInput(): Promise<boolean>;
    /**
     * Returns True to continue chat and False to stop the chat.
     * @param {string} prompt
     * @param {ModelInfo} model
     * @param {{ packedPrompt: string, injected: string[] }} packed
     * @param {number} [step=1]
     * @returns {Promise<boolean>}
     */
    prepare(prompt: string, model: ModelInfo, packed: {
        packedPrompt: string;
        injected: string[];
    }, step?: number): Promise<boolean>;
    /**
     * Decodes the answer and return the next prompt
     * @param {import("../llm/chatLoop.js").sendAndStreamOptions} sent
     * @param {number} [step=1]
     * @returns {Promise<{ answer: string, shouldContinue: boolean, logs: string[], prompt: string }>}
     */
    unpack(sent: import("../llm/chatLoop.js").sendAndStreamOptions, step?: number): Promise<{
        answer: string;
        shouldContinue: boolean;
        logs: string[];
        prompt: string;
    }>;
    /**
     *
     * @param {string} prompt
     * @param {ModelInfo} model
     * @param {number} [step=1]
     * @returns {Promise<import("../llm/chatLoop.js").sendAndStreamOptions>}
     */
    send(prompt: string, model: ModelInfo, step?: number): Promise<import("../llm/chatLoop.js").sendAndStreamOptions>;
    /**
     *
     * @param {number} [step=1]
     * @returns {Promise<{ shouldContinue: boolean, test?: import("../cli/testing/node.js").TestOutput }>}
     */
    test(step?: number): Promise<{
        shouldContinue: boolean;
        test?: import("../cli/testing/node.js").TestOutput;
    }>;
    /**
     *
     * @param {import("../llm/chatSteps.js").TestOutput} tested
     * @param {number} [step=1]
     */
    next(tested: import("../llm/chatSteps.js").TestOutput, step?: number): Promise<void>;
    /**
     * Starts the chat:
     * 1. Detect the recent step
     * 1.1. for Test it should go from the first step
     * 1.2. for Real it should go from the recent step
     * 2. Prepare input (pack prompt with messages)
     * 3. Select a model
     * 3.1. for Test it should be selected from saved log
     * 3.2. for Real it should use available by the algorithm
     * @returns {Promise<{ step: number, prompt: string, model: ModelInfo, packed: { packedPrompt: string, injected: string[] } }>}
     */
    start(): Promise<{
        step: number;
        prompt: string;
        model: ModelInfo;
        packed: {
            packedPrompt: string;
            injected: string[];
        };
    }>;
    loop(): Promise<void>;
    #private;
}
export default ChatCLiApp;
import { FileSystem } from "../utils/index.js";
import { Git } from "../utils/index.js";
import { Ui } from "./Ui.js";
import { AI } from "../llm/index.js";
import { ChatOptions } from "../Chat/index.js";
import { Chat } from "../llm/index.js";
import { ModelInfo } from "../llm/index.js";
