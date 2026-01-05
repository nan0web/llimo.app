/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 *
 * In test mode, instead of calling real AI providers, it loads responses from:
 * - steps/+/answer.md       full response content
 * - steps/+/chunks.jsonl    array of chunk objects for streaming simulation
 * - steps/+/input.md        input prompt (before agent injections)
 * - steps/+/model.json      model information
 * - steps/+/prompt.md       prompt message (after agent injections)
 * - steps/+/reason.md       reasoning content
 * - steps/+/response.json   auxiliary data (usage, etc.)
 * - steps/+/stream.jsonl    array of stream events (falling back if chunks.jsonl missing)
 * - steps/+/stream.md       additional stream text (appended)
 * - steps/+/tests.txt       logged but not used for response (e.g., expected test outputs)
 * - steps/+/tests.err       errors as text that should be sent to LLiMo
 * - steps/+/tests.json      Record<"fail" | "cancelled" | "types" | "skip" | "todo" | "pass" | "types", number>
 * - steps/+/time.json       { read: number, reason: number, answer: number, tests: number } spent time in ms
 * - steps/+/todo.md         logged but not used for response (e.g., remaining tasks) > TODO tests
 * - steps/+/unknown.jsonl   logged but not used for response (e.g., unhandled data)
 * - steps/+/usage.json      step usage info
 * - files.jsonl             injected files (references)
 * - messages.jsonl          Array<{ role: string, content: string }> like storage of the messages
 * - tests.txt               root tests - logged but not used for response (e.g., expected test outputs)
 * - tests.err               root tests - errors as text that should be sent to LLiMo
 * - tests.json              root tests - Record<"fail" | "cancelled" | "types" | "skip" | "todo" | "pass" | "types", number>
 *
 * Supports per-step simulation by prefixing files with `step${options.step}/`
 */
export class TestAI extends AI {
    /**
     * Simulates streaming by reading chunks from files and yielding them with delays.
     * Loads chat state from files if available. Handles all specified chat files.
     * Updated to load me.md, split into blocks by ---, trim, filter new blocks not in previous user messages,
     * but since it's test, use the full content as original (but simulate filtering if needed).
     * @param {any} modelId
     * @param {ModelMessage[]} messages
     * @param {UIMessageStreamOptions} [options={}]
     * @returns {Promise<import('ai').StreamTextResult<import('ai').ToolSet>>}
     */
    streamText(modelId: any, messages: ModelMessage[], options?: UIMessageStreamOptions): Promise<import("ai").StreamTextResult<import("ai").ToolSet, any>>;
    /**
     * Non-streaming version (for completeness, just returns full response).
     * @param {string} modelId
     * @param {ModelMessage[]} messages
     * @param {{cwd?: string, step?: number}} [options]
     * @returns {Promise<{text: string, usage: Usage}>}
     */
    generateText(modelId: string, messages: ModelMessage[], options?: {
        cwd?: string;
        step?: number;
    }): Promise<{
        text: string;
        usage: Usage;
    }>;
    /**
     * Simulates the chat from the beginning till the end through all the steps.
     * No files write/remove access, only reading and priting saved logs.
     * No real tests execution, only reading and priting saved logs.
     *
     * Workflow
     * 1. load current chat --chat-dir.
     * 2. start the chat.
     * 2.1. simulate root (0) tests if present.
     * 2.2. simulate the input, prompt.
     * 2.3. simulate the output with the same speed calculate from time.json, usage.json and tests.txt.
     * 2.4. simulate unpack.
     * 2.5. simulate tests.
     * 3. complete the chat.
     */
    simulateChat(): Promise<void>;
    /**
     * Runs the chat loop.
     *
     * Workflow
     * 1. load current chat --chat-dir or start new if --new.
     * 2. start the chat.
     * 2.1. Run tests if --fix provided.
     * 2.2. Pack input > prompt.
     * 2.3. Send chat messages to API.
     * 2.4. Unpack the response.
     * 2.5. Run tests.
     * 2.6. Continue the chat if any test fail (exitCode !== 0).
     * 3. complete the chat.
     */
    chat(): Promise<void>;
    simulateRelease(): Promise<void>;
}
export type StreamTextResult = import("ai").StreamTextResult<any, any>;
export type ModelMessage = import("ai").ModelMessage;
export type UIMessageStreamOptions = import("ai").UIMessageStreamOptions<import("ai").UIMessage<any, any, any>>;
import { AI } from "./AI.js";
import { Usage } from "./Usage.js";
