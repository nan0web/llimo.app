/**
 * Pre-selects a model (loads from cache or defaults). If multiple matches,
 * shows the table and prompts. Persists selection to chat.config.model.
 *
 * @param {import("../llm/AI.js").default} ai
 * @param {import("./Ui.js").Ui} ui
 * @param {string} modelStr
 * @param {string} providerStr
 * @param {(chosen: import("../llm/ModelInfo.js").default) => void} [onSelect]   Current chat instance
 * @returns {Promise<import("../llm/ModelInfo.js").default>}
 */
export function selectAndShowModel(ai: import("../llm/AI.js").default, ui: import("./Ui.js").Ui, modelStr: string, providerStr: string, onSelect?: (chosen: import("../llm/ModelInfo.js").default) => void): Promise<import("../llm/ModelInfo.js").default>;
