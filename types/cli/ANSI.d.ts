/**
 * Overwrite the current line in the terminal.
 *
 * @param {string} [str=""] - The string to write after clearing the line.
 * @returns {string} The ANSI sequence to overwrite the line followed by the string.
 */
export function overwriteLine(str?: string): string;
/**
 * Move the cursor up by a specified number of rows.
 *
 * @param {number} [rows=1] - The number of rows to move the cursor up.
 * @returns {string} The ANSI escape sequence to move the cursor.
 */
export function cursorUp(rows?: number): string;
/**
 * Strip ANSI escape sequences (colour codes, cursor movements, etc.) from a string.
 *
 * @param {string} str - Input string that may contain ANSI codes.
 * @returns {string} The string with all ANSI escape sequences removed.
 *
 * The implementation uses a regular expression that matches the most common
 * ANSI escape sequences (`\x1b[` followed by zero or more digits/semicolons and a
 * final letter). This covers colour codes, text attributes, cursor controls,
 * and other CSI sequences. For exotic sequences not covered by the pattern the
 * function will still return a reasonably cleaned string.
 */
export function stripANSI(str: string): string;
export const RESET: "" | "\u001B[0m";
export const BOLD: "" | "\u001B[1m";
export const DIM: "" | "\u001B[2m";
export const ITALIC: "" | "\u001B[3m";
export const BLACK: "" | "\u001B[30m";
export const RED: "" | "\u001B[31m";
export const GREEN: "" | "\u001B[32m";
export const YELLOW: "" | "\u001B[33m";
export const BLUE: "" | "\u001B[34m";
export const MAGENTA: "" | "\u001B[35m";
export const CYAN: "" | "\u001B[36m";
export namespace COLORS {
    export { BLACK };
    export { RED };
    export { GREEN };
    export { YELLOW };
    export { BLUE };
    export { MAGENTA };
    export { CYAN };
}
export const CLEAR_LINE: "\u001B[2K";
export const OVERWRITE_LINE: "\r\u001B[K";
