/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 */
export class TestAI extends AI {
    streamText(model: any, messages: any, options?: {}): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        text: string;
        reasoning: string;
        content: string;
        reasoningText: string;
        textStream: {
            [Symbol.asyncIterator]: () => AsyncGenerator<any, void, unknown>;
        };
        usage: Usage;
        rawCall: {
            messageId: `${string}-${string}-${string}-${string}-${string}`;
        };
        experimental_output: never[];
        warnings: never[];
        files: never[];
        sources: never[];
        toolCalls: never[];
        toolResults: never[];
        finishReason: string;
        stopReason: string;
        response: {
            id: string;
            timestamp: Date;
            modelId: string;
            headers: {};
            messages: never[];
        };
    }>;
    /**
     * Non-streaming version.
     * @param {any} model
     * @param {ModelMessage[]} messages
     * @param {object} [options]
     * @returns {Promise<{text: string, usage: Usage}>}
     */
    generateText(model: any, messages: ModelMessage[], options?: object): Promise<{
        text: string;
        usage: Usage;
    }>;
}
export type StreamTextResult = import("ai").StreamTextResult<any, any>;
export type ModelMessage = import("ai").ModelMessage;
export type UIMessageStreamOptions = import("ai").UIMessageStreamOptions<import("ai").UIMessage>;
import { AI } from "./AI.js";
import { Usage } from "./Usage.js";
