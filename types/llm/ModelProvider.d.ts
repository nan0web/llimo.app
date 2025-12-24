export default class ModelProvider {
    constructor(input?: {});
    get cachePath(): string;
    /**
     * Load the cache file if it exists and is fresh.
     * @param {string} provider
     * @returns {Promise<ModelInfo[] | null>}
     */
    loadCache(provider: string): Promise<ModelInfo[] | null>;
    /**
     * Write fresh data to the cache as JSONL (one model per line).
     * @param {any} data
     * @param {string} provider
     */
    writeCache(data: any, provider: string): Promise<void>;
    /**
     * Fetch model list from a provider endpoint.
     *
     * The function knows how to call each supported provider.
     *
     * @param {AvailableProvider} provider
     * @returns {Promise<Array<Partial<ModelInfo> & {id: string}>>} Raw model data.
     */
    fetchFromProvider(provider: AvailableProvider): Promise<Array<Partial<ModelInfo> & {
        id: string;
    }>>;
    /**
     *
     * @param {string | URL | globalThis.Request} url
     * @param {RequestInit} options
     * @returns {Promise<Response>}
     */
    fetch(url: string | URL | globalThis.Request, options: RequestInit): Promise<Response>;
    /**
     * Flatten multi-provider entries into separate ModelInfo instances.
     * @param {Array<ModelInfo & { providers?: Partial<ModelInfo> }>} arr
     * @param {AvailableProvider} provider
     * @param {Array<[string, Partial<ModelInfo>]>} [predefined]
     * @returns {ModelInfo[]}
     */
    _makeFlat(arr: Array<ModelInfo & {
        providers?: Partial<ModelInfo>;
    }>, provider: AvailableProvider, predefined?: Array<[string, Partial<ModelInfo>]>): ModelInfo[];
    /**
     * Return a map of model-id → array of ModelInfo (one per provider variant).
     *
     * Attempts cache first. If stale/missing, fetches from providers, merges with static info,
     * updates cache, and returns. Errors per-provider are swallowed, falling back to static.
     *
     * @param {object} [options={}]
     * @param {function(string, string[]): void} [options.onBefore] Called before fetch.
     * @param {function(string, any, ModelInfo[]): void} [options.onData] Called after normalization.
     * @param {boolean} [options.noCache]
     * @returns {Promise<Map<string, ModelInfo>>}
     */
    getAll(options?: {
        onBefore?: ((arg0: string, arg1: string[]) => void) | undefined;
        onData?: ((arg0: string, arg1: any, arg2: ModelInfo[]) => void) | undefined;
        noCache?: boolean | undefined;
    }): Promise<Map<string, ModelInfo>>;
    /**
     * @param {Array} raw
     * @param {AvailableProvider} name
     */
    flatten(raw: any[], name: AvailableProvider): ModelInfo[];
    #private;
}
export type AvailableProvider = "cerebras" | "openrouter" | "huggingface";
import ModelInfo from "./ModelInfo.js";
