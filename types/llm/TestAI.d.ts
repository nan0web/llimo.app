/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 *
 * In test mode, instead of calling real AI providers, it loads responses from:
 * - chunks.json: array of chunk objects for streaming simulation
 * - stream.json: array of stream events (falling back if chunks.json missing)
 * - messages.jsonl: overrides chat messages if present
 * - reason.md: reasoning content
 * - answer.md: full response content
 * - response.json: auxiliary data (ignored)
 * - stream.md: additional stream text (appended)
 * - tests.txt, todo.md, unknown.json: logged but not used for response
 * - me.md: ignored, as it's user input
 * - prompt.md: ignored, as prompt is already packed
 */
export default class TestAI extends AI {
    /**
     * @param {object} input
     * @param {Array<readonly [string, Partial<ModelInfo>]> | Map<string, Partial<ModelInfo>>} input.models
     */
    constructor(input?: {
        models: Array<readonly [string, Partial<ModelInfo>]> | Map<string, Partial<ModelInfo>>;
    });
    /**
     * Simulates streaming by reading chunks from files and yielding them with delays.
     * Loads chat state from files if available.
     * @param {string} modelId - Must be "test-model"
     * @param {import('ai').ModelMessage[]} messages - Current chat messages
     * @param {object} options - Streaming options
     * @param {string} options.cwd - Chat directory (where files are located)
     * @returns {Promise<{ fullResponse: string, reasoning: string, usage: import("../llm/AI.js").Usage, chunks: any[], stream: AsyncIterable<any> }>}
     */
    streamText(modelId: string, messages: import("ai").ModelMessage[], options?: {
        cwd: string;
    }): Promise<{
        fullResponse: string;
        reasoning: string;
        usage: import("../llm/AI.js").Usage;
        chunks: any[];
        stream: AsyncIterable<any>;
    }>;
    /**
     * Non-streaming version (for completeness, just returns full response).
     */
    generateText(modelId: any, messages: any, options?: {}): Promise<{
        text: string;
        usage: any;
    }>;
}
import AI from "./AI.js";
