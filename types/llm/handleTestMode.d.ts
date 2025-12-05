/**
 * Handles the test mode simulation for llmo-chat.
 * Extracted from the main script's if (testMode || testDir) block.
 *
 * @param {Object} options
 * @param {AI} options.ai - The TestAI instance.
 * @param {Ui} options.ui - UI instance for output.
 * @param {string} options.cwd - The chat directory for test files.
 * @param {string} options.input - The user input.
 * @param {Chat} options.chat - The chat instance.
 * @param {ModelInfo} options.model - Dummy model for progress.
 * @param {number} options.fps
 * @returns {Promise<void>}
 * @throws {Error} If simulation fails.
 */
export function handleTestMode(options: {
    ai: AI;
    ui: Ui;
    cwd: string;
    input: string;
    chat: Chat;
    model: ModelInfo;
    fps: number;
}): Promise<void>;
import AI from "./AI.js";
import Ui from "../cli/Ui.js";
import Chat from "./Chat.js";
import ModelInfo from "./ModelInfo.js";
