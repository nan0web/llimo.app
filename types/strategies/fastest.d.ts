/**
 * @typedef {Object} APIError
 * @property {string} message
 * @property {string} stack
 * @property {number} status
 * @property {number} refreshAt
 */
/**
 * Pick next model strategy on error.
 * @param {import("../llm/ModelInfo.js").default} model
 * @param {import("../llm/Chat.js").default} chat
 * @param {APIError|null} error
 * @param {Map<string, number>} prev
 * @param {number} [now]
 * @returns {[string, string]|undefined}
 */
export default function fastestStrategy(model: import("../llm/ModelInfo.js").default, chat: import("../llm/Chat.js").default, error: APIError | null, prev: Map<string, number>, now?: number): [string, string] | undefined;
export type APIError = {
    message: string;
    stack: string;
    status: number;
    refreshAt: number;
};
