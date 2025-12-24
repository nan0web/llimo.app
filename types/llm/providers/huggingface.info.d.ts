/**
 * Returns static model info for Hugging Face, including subproviders like Cerebras and Z.ai.
 * Each entry is [modelId, config] where config includes pricing per 1M tokens.
 * @returns {{ models: Array<[string, Partial<ModelInfo>]> }} Model pairs for normalization.
 */
export default function getHuggingFaceInfo(): {
    models: Array<[string, Partial<ModelInfo>]>;
};
import ModelInfo from "../ModelInfo.js";
