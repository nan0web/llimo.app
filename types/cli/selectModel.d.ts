/**
 * @param {import("../llm/AI.js").default} ai
 * @param {import("./Ui.js").Ui} ui
 * @param {string} modelStr
 * @param {string} providerStr
 * @param {(chosen: import("../llm/ModelInfo.js").default) => void} [onSelect]   Current chat instance
 * @returns {Promise<import("../llm/ModelInfo.js").default>}
 */
export function selectAndShowModel(ai: import("../llm/AI.js").default, ui: import("./Ui.js").Ui, modelStr: string, providerStr: string, onSelect?: (chosen: import("../llm/ModelInfo.js").default) => void, options?: {}): Promise<import("../llm/ModelInfo.js").default>;
