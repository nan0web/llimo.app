/**
 * @typedef {Object} StreamOptions callbacks and abort signal
 * @property {AbortSignal} [abortSignal] aborts the request when signaled
 * @property {import('ai').StreamTextOnChunkCallback<import('ai').ToolSet>} [onChunk] called for each raw chunk
 * @property {import('ai').StreamTextOnStepFinishCallback<import('ai').ToolSet>} [onStepFinish] called after a logical step finishes (see description above)
 * @property {import('ai').StreamTextOnErrorCallback} [onError] called on stream error
 * @property {()=>void} [onFinish] called when the stream ends successfully
 * @property {()=>void} [onAbort] called when the stream is aborted
 */
/**
 * Wrapper for AI providers.
 *
 * Apart from the static model list, the class now exposes a method
 * `refreshModels()` that pulls the latest info from each provider (via
 * `api/models/`) and caches the result for one hour.
 *
 * @class
 */
export default class AI {
    /**
     * @param {Object} input
     * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo>} [input.models=[]]
     * @param {ModelInfo} [input.selectedModel]
     */
    constructor(input?: {
        models?: Map<string, ModelInfo> | readonly [string, ModelInfo] | undefined;
        selectedModel?: ModelInfo | undefined;
    });
    /** @type {ModelInfo?} */
    selectedModel: ModelInfo | null;
    /**
     * Flatten and normalize models to Map<string, ModelInfo[]>. Handles:
     * - Map: Pass-through.
     * - Array<[string, ModelInfo[]]>: Direct set.
     * - Array<[string, ModelInfo]>: Wrap singles in arrays.
     * - Nested providers (e.g., {providers: [{provider:'a'}]}): Expand to prefixed IDs (e.g., 'model:a').
     * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo> | readonly[string, Partial<ModelInfo> & {providers?: {provider: string}[]}] } models
     */
    setModels(models: readonly [string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo> | readonly [string, Partial<ModelInfo> & {
        providers?: {
            provider: string;
        }[];
    }]): void;
    /**
     * Refresh model information from remote providers.
     *
     * The method updates the internal `#models` map with the merged static +
     * remote data. It respects the cache (see `ModelProvider`).
     *
     * @returns {Promise<void>}
     */
    refreshModels(): Promise<void>;
    /**
     * Get list of available models (after optional refresh).
     *
     * @returns {ModelInfo[]}
     */
    getModels(): ModelInfo[];
    /**
     *
     * @returns {Map<string, ModelInfo>}
     */
    getModelsMap(): Map<string, ModelInfo>;
    /**
     * Get model info by ID.
     *
     * @param {string} modelId
     * @returns {ModelInfo[]}
     */
    getModel(modelId: string): ModelInfo[];
    /**
     * Returns the model for the specific provider with absolute equality.
     * @param {string} model
     * @param {string} provider
     * @returns {ModelInfo | undefined}
     */
    getProviderModel(model: string, provider: string): ModelInfo | undefined;
    /**
     * Find a model from all of the models by partial comparasion.
     * @param {string} modelId The full or partial model id.
     * @returns {ModelInfo | undefined}
     */
    findModel(modelId: string): ModelInfo | undefined;
    /**
     * Find models that matches modelId from all of the models by partial comparasion.
     * @param {string} modelId The full or partial model id.
     * @returns {ModelInfo[]}
     */
    findModels(modelId: string): ModelInfo[];
    /**
     * Add a model to the internal map (for testing).
     *
     * @param {string} id
     * @param {Partial<ModelInfo>} info
     */
    addModel(id: string, info: Partial<ModelInfo>): void;
    /**
     * Get provider instance for a model.
     *
     * @param {string} provider
     * @returns {any}
     */
    getProvider(provider: string): any;
    /**
     * Stream text from a model.
     *
     * The method forwards the call to `ai.streamText` while providing a set of
     * optional hooks that can be used by callers to monitor or control the
     * streaming lifecycle.
     *
     * @param {ModelInfo} model
     * @param {import('ai').ModelMessage[]} messages
     * @param {import('ai').UIMessageStreamOptions<import('ai').UIMessage>} [options={}]
     * @returns {import('ai').StreamTextResult<import('ai').ToolSet>}
     */
    streamText(model: ModelInfo, messages: import("ai").ModelMessage[], options?: import("ai").UIMessageStreamOptions<import("ai").UIMessage>): import("ai").StreamTextResult<import("ai").ToolSet, any>;
    /**
     * Generate text from a model (non‑streaming).
     *
     * @param {string} modelId
     * @param {import('ai').ModelMessage[]} messages
     * @returns {Promise<{text: string, usage: LanguageModelUsage}>}
     */
    generateText(modelId: string, messages: import("ai").ModelMessage[]): Promise<{
        text: string;
        usage: LanguageModelUsage;
    }>;
    #private;
}
/**
 * callbacks and abort signal
 */
export type StreamOptions = {
    /**
     * aborts the request when signaled
     */
    abortSignal?: AbortSignal | undefined;
    /**
     * called for each raw chunk
     */
    onChunk?: import("ai").StreamTextOnChunkCallback<import("ai").ToolSet> | undefined;
    /**
     * called after a logical step finishes (see description above)
     */
    onStepFinish?: import("ai").StreamTextOnStepFinishCallback<import("ai").ToolSet> | undefined;
    /**
     * called on stream error
     */
    onError?: import("ai").StreamTextOnErrorCallback | undefined;
    /**
     * called when the stream ends successfully
     */
    onFinish?: (() => void) | undefined;
    /**
     * called when the stream is aborted
     */
    onAbort?: (() => void) | undefined;
};
import ModelInfo from './ModelInfo.js';
import LanguageModelUsage from './LanguageModelUsage.js';
