/**
 * Generates the system prompt markdown.
 * @param {string} [outputPath] - Optional path to write the system prompt to.
 * @returns {Promise<string>} - The generated system prompt string.
 */
export function generateSystemPrompt(outputPath?: string): Promise<string>;
/**
 * @param {string} content
 * @returns {{ content: string, vars: object }}
 */
export function parseSystemPrompt(content: string): {
    content: string;
    vars: object;
};
/**
 * @param {string[] | Array<{ content: string, vars: object }>} arr
 * @returns {{ head: string, body: string, vars: ChatOptions }}
 */
export function mergeSystemPrompts(arr: string[] | Array<{
    content: string;
    vars: object;
}>): {
    head: string;
    body: string;
    vars: ChatOptions;
};
import ChatOptions from "../Chat/Options.js";
