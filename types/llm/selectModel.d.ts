/**
 * Helper to select a model (and optionally its provider) from a list of
 * {@link ModelInfo} objects based on partial
 * identifiers supplied on the CLI.
 *
 * The function:
 *   1. Filters the supplied `models` map by the optional `modelPartial`
 *      and `providerPartial` strings (case‑insensitive `includes`).
 *   2. Handles three outcomes:
 *        - **0 matches** → throws an error.
 *        - **1 match**  → returns that model.
 *        - **>1 match** → presents a numbered list via the supplied `ui`
 *          instance and asks the user to pick one.
 *
 * The chosen model (its `id` and `provider`) are persisted in
 * `.cache/llimo.config.json` inside the current working directory,
 * making subsequent runs of the CLI default to the same selection.
 *
 * @param {Map<string, ModelInfo>} models
 * @param {string} modelPartial   Partial model identifier (e.g. "oss")
 * @param {string|undefined} providerPartial   Partial provider name (e.g. "cere")
 * @param {Ui} ui   UI helper for interactive prompts
 * @param {(chosen: ModelInfo) => void} [onSelect]   Current chat instance
 * @returns {Promise<ModelInfo | undefined>}
 */
export function selectModel(models: Map<string, ModelInfo>, modelPartial: string, providerPartial: string | undefined, ui: Ui, onSelect?: (chosen: ModelInfo) => void): Promise<ModelInfo | undefined>;
import { ModelInfo } from "./ModelInfo.js";
import { Ui } from "../cli/Ui.js";
