/**
 * @typedef {Object} sendAndStreamOptions
 * @property {string} answer
 * @property {string} reason
 * @property {Usage} usage
 * @property {any[]} unknowns
 * @property {any} [error]
 */
/**
 * Executes the send and stream part of the chat loop.
 * @param {Object} options
 * @param {AI} options.ai
 * @param {Chat} options.chat
 * @param {Ui} options.ui
 * @param {string} options.prompt
 * @param {number} options.step
 * @param {(n: number) => string} options.format
 * @param {(n: number) => string} options.valuta
 * @param {ModelInfo} options.model
 * @param {boolean} [options.isTiny=false] - If true, use one-line progress mode
 * @param {number} [options.fps=30]
 * @returns {Promise<sendAndStreamOptions>}
 */
export function sendAndStream(options: {
    ai: AI;
    chat: Chat;
    ui: Ui;
    prompt: string;
    step: number;
    format: (n: number) => string;
    valuta: (n: number) => string;
    model: ModelInfo;
    isTiny?: boolean | undefined;
    fps?: number | undefined;
}): Promise<sendAndStreamOptions>;
export type sendAndStreamOptions = {
    answer: string;
    reason: string;
    usage: Usage;
    unknowns: any[];
    error?: any;
};
import AI from "./AI.js";
import Chat from "./Chat.js";
import Ui from "../cli/Ui.js";
import ModelInfo from "./ModelInfo.js";
import Usage from "./Usage.js";
