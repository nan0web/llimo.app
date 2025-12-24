/**
 * @typedef {Object} ChatProgressInput
 * @property {Ui} ui
 * @property {LanguageModelUsage} usage
 * @property {{ startTime:number, reasonTime?:number, answerTime?:number }} clock
 * @property {ModelInfo} model
 * @property {boolean} [isTiny] tiny‑mode flag
 * @property {number} [step] step number (used in tiny mode)
 * @property {number} [now] Date.now()
 * @property {number} [precision=4]
 */
/**
 * Produce human‑readable progress rows.
 *
 * @param {ChatProgressInput} input
 * @returns {string[]}
 */
export function formatChatProgress(input: ChatProgressInput): string[];
export type ChatProgressInput = {
    ui: Ui;
    usage: LanguageModelUsage;
    clock: {
        startTime: number;
        reasonTime?: number;
        answerTime?: number;
    };
    model: ModelInfo;
    /**
     * tiny‑mode flag
     */
    isTiny?: boolean | undefined;
    /**
     * step number (used in tiny mode)
     */
    step?: number | undefined;
    /**
     * Date.now()
     */
    now?: number | undefined;
    precision?: number | undefined;
};
import Ui from "../cli/Ui.js";
import LanguageModelUsage from "./LanguageModelUsage.js";
import ModelInfo from "./ModelInfo.js";
