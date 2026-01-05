/**
 * @param {{ noCache?: boolean, ui?: Ui }} [opts={}]
 * @returns {Promise<Map<string, ModelInfo>>}
 */
export function loadModels(opts?: {
    noCache?: boolean;
    ui?: Ui;
}): Promise<Map<string, ModelInfo>>;
import { Ui } from "../cli/Ui.js";
import { ModelInfo } from "../llm/ModelInfo.js";
