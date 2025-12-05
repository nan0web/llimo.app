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
export let RESET: any;
export let BOLD: any;
export let DIM: any;
export let ITALIC: any;
export let UNDERLINE: any;
export let BLINK: any;
export let RAPID_BLINK: any;
export let INVERSE: any;
export let CONCEAL: any;
export let STRIKETHROUGH: any;
export let BLACK: any;
export let RED: any;
export let GREEN: any;
export let YELLOW: any;
export let BLUE: any;
export let MAGENTA: any;
export let CYAN: any;
export let WHITE: any;
export let BRIGHT_BLACK: any;
export let BRIGHT_RED: any;
export let BRIGHT_GREEN: any;
export let BRIGHT_YELLOW: any;
export let BRIGHT_BLUE: any;
export let BRIGHT_MAGENTA: any;
export let BRIGHT_CYAN: any;
export let BRIGHT_WHITE: any;
export let BG_BLACK: any;
export let BG_RED: any;
export let BG_GREEN: any;
export let BG_YELLOW: any;
export let BG_BLUE: any;
export let BG_MAGENTA: any;
export let BG_CYAN: any;
export let BG_WHITE: any;
export let BG_BRIGHT_BLACK: any;
export let BG_BRIGHT_RED: any;
export let BG_BRIGHT_GREEN: any;
export let BG_BRIGHT_YELLOW: any;
export let BG_BRIGHT_BLUE: any;
export let BG_BRIGHT_MAGENTA: any;
export let BG_BRIGHT_CYAN: any;
export let BG_BRIGHT_WHITE: any;
export let COLORS: any;
export let BG_COLORS: any;
export let CLEAR_LINE: any;
export let OVERWRITE_LINE: any;
export type AnsiColors = {
    BLACK: string;
    RED: string;
    GREEN: string;
    YELLOW: string;
    BLUE: string;
    MAGENTA: string;
    CYAN: string;
    WHITE: string;
    BRIGHT_BLACK: string;
    BRIGHT_RED: string;
    BRIGHT_GREEN: string;
    BRIGHT_YELLOW: string;
    BRIGHT_BLUE: string;
    BRIGHT_MAGENTA: string;
    BRIGHT_CYAN: string;
    BRIGHT_WHITE: string;
};
export type AnsiBgColors = {
    BLACK: string;
    RED: string;
    GREEN: string;
    YELLOW: string;
    BLUE: string;
    MAGENTA: string;
    CYAN: string;
    WHITE: string;
    BRIGHT_BLACK: string;
    BRIGHT_RED: string;
    BRIGHT_GREEN: string;
    BRIGHT_YELLOW: string;
    BRIGHT_BLUE: string;
    BRIGHT_MAGENTA: string;
    BRIGHT_CYAN: string;
    BRIGHT_WHITE: string;
};
