/**
 * @param {Ui} ui
 * @returns {Promise<
 * Map<string, ModelInfo[]>>}
 */
export function loadModels(ui: Ui): Promise<Map<string, ModelInfo[]>>;
import { Ui } from "../cli/Ui.js";
import ModelInfo from "../llm/ModelInfo.js";
