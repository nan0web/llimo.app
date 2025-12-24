/**
 * @param {Ui} ui
 * @param {{ noCache?: boolean }} [opts={}]
 * @returns {Promise<Map<string, ModelInfo>>}
 */
export function loadModels(ui: Ui, opts?: {
    noCache?: boolean;
}): Promise<Map<string, ModelInfo>>;
import { Ui } from "../cli/Ui.js";
import ModelInfo from "../llm/ModelInfo.js";
