/**
 * Represents information about a model.
 */
export default class ModelInfo {
    /**
     * @param {Partial<ModelInfo>} input
     */
    constructor(input?: Partial<ModelInfo>);
    /** @type {string} - Model ID */
    id: string;
    /** @type {Architecture} - Model architecture */
    architecture: Architecture;
    /** @type {string} */
    canonical_slug: string;
    /** @type {number} */
    context_length: number;
    /** @type {number} */
    created: number;
    /** @type {object} */
    default_parameters: object;
    /** @type {string} */
    description: string;
    /** @type {string} */
    hugging_face_id: string;
    /** @type {string} */
    name: string;
    /** @type {number} */
    per_request_limit: number;
    /** @type {Pricing} */
    pricing: Pricing;
    /** @type {string[]} - Supported parameters */
    supported_parameters: string[];
    /** @type {string} - Provider name (openai, cerebras, …) */
    provider: string;
    /** @type {TopProvider} */
    top_provider: TopProvider;
}
import Architecture from "./Architecture.js";
import Pricing from "./Pricing.js";
import TopProvider from "./TopProvider.js";
