/**
 * Helper for generating the chat‑progress lines shown during streaming.
 *
 * The function is a pure formatter – it receives runtime data and returns
 * ready‑to‑print strings.  It is unit‑tested in `chatProgress.test.js`.
 *
 * @typedef {Object} ChatProgressInput
 * @property {import("../llm/AI.js").Usage} usage
 * @property {{ startTime: number, reasonTime?: number, answerTime?: number }} clock
 * @property {import("../llm/AI.js").ModelInfo} model
 * @property {(n:number)=>string} [format]     number formatter (e.g. Intl.NumberFormat)
 * @property {(n:number)=>string} [valuta]     price formatter (prefixed with $)
 * @property {number} [elapsed]                total elapsed seconds (overrides clock calculation)
 * @property {number} [now]                    Date.now()
 *
 * @param {ChatProgressInput} input
 * @returns {string[]} array of formatted lines ready for console output
 */
export function formatChatProgress(input: ChatProgressInput): string[];
/**
 * Helper for generating the chat‑progress lines shown during streaming.
 *
 * The function is a pure formatter – it receives runtime data and returns
 * ready‑to‑print strings.  It is unit‑tested in `chatProgress.test.js`.
 */
export type ChatProgressInput = {
    usage: import("../llm/AI.js").Usage;
    clock: {
        startTime: number;
        reasonTime?: number;
        answerTime?: number;
    };
    model: import("../llm/AI.js").ModelInfo;
    /**
     * number formatter (e.g. Intl.NumberFormat)
     */
    format?: ((n: number) => string) | undefined;
    /**
     * price formatter (prefixed with $)
     */
    valuta?: ((n: number) => string) | undefined;
    /**
     * total elapsed seconds (overrides clock calculation)
     */
    elapsed?: number | undefined;
    /**
     * Date.now()
     */
    now?: number | undefined;
};
