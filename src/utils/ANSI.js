import process from "node:process"

/**
 * ANSI escape codes used for terminal formatting.
 *
 * All constants are defined conditionally – when the output is not a TTY (e.g.
 * when the output is captured in tests) the value is an empty string so that
 * the raw escape sequences do not interfere with string comparisons.
 *
 * The list covers:
 *   • basic text attributes (reset, bold, dim, italic, underline, blink, rapid
 *     blink, inverse, conceal, strikethrough)
 *   • foreground colours (standard and bright)
 *   • background colours (standard and bright)
 *
 * If you need additional SGR codes you can extend this module in the same
 * fashion.
 */

const isTTY = process.stdout.isTTY

// Text attributes ------------------------------------------------------------
export const RESET = isTTY ? "\x1b[0m" : ""
export const BOLD = isTTY ? "\x1b[1m" : ""
export const DIM = isTTY ? "\x1b[2m" : ""
export const ITALIC = isTTY ? "\x1b[3m" : ""
export const UNDERLINE = isTTY ? "\x1b[4m" : ""
export const BLINK = isTTY ? "\x1b[5m" : ""            // slow blink
export const RAPID_BLINK = isTTY ? "\x1b[6m" : ""        // rapid blink (unsupported on many terminals)
export const INVERSE = isTTY ? "\x1b[7m" : ""
export const CONCEAL = isTTY ? "\x1b[8m" : ""          // concealed / hidden text
export const STRIKETHROUGH = isTTY ? "\x1b[9m" : ""

// Foreground colours --------------------------------------------------------
export const BLACK = isTTY ? "\x1b[30m" : ""
export const RED = isTTY ? "\x1b[31m" : ""
export const GREEN = isTTY ? "\x1b[32m" : ""
export const YELLOW = isTTY ? "\x1b[33m" : ""
export const BLUE = isTTY ? "\x1b[34m" : ""
export const MAGENTA = isTTY ? "\x1b[35m" : ""
export const CYAN = isTTY ? "\x1b[36m" : ""
export const WHITE = isTTY ? "\x1b[37m" : ""
// Bright (high‑intensity) foreground colours (code 90‑97)
export const BRIGHT_BLACK = isTTY ? "\x1b[90m" : ""
export const BRIGHT_RED = isTTY ? "\x1b[91m" : ""
export const BRIGHT_GREEN = isTTY ? "\x1b[92m" : ""
export const BRIGHT_YELLOW = isTTY ? "\x1b[93m" : ""
export const BRIGHT_BLUE = isTTY ? "\x1b[94m" : ""
export const BRIGHT_MAGENTA = isTTY ? "\x1b[95m" : ""
export const BRIGHT_CYAN = isTTY ? "\x1b[96m" : ""
export const BRIGHT_WHITE = isTTY ? "\x1b[97m" : ""

// Background colours --------------------------------------------------------
export const BG_BLACK = isTTY ? "\x1b[40m" : ""
export const BG_RED = isTTY ? "\x1b[41m" : ""
export const BG_GREEN = isTTY ? "\x1b[42m" : ""
export const BG_YELLOW = isTTY ? "\x1b[43m" : ""
export const BG_BLUE = isTTY ? "\x1b[44m" : ""
export const BG_MAGENTA = isTTY ? "\x1b[45m" : ""
export const BG_CYAN = isTTY ? "\x1b[46m" : ""
export const BG_WHITE = isTTY ? "\x1b[47m" : ""
// Bright background colours (code 100‑107)
export const BG_BRIGHT_BLACK = isTTY ? "\x1b[100m" : ""
export const BG_BRIGHT_RED = isTTY ? "\x1b[101m" : ""
export const BG_BRIGHT_GREEN = isTTY ? "\x1b[102m" : ""
export const BG_BRIGHT_YELLOW = isTTY ? "\x1b[103m" : ""
export const BG_BRIGHT_BLUE = isTTY ? "\x1b[104m" : ""
export const BG_BRIGHT_MAGENTA = isTTY ? "\x1b[105m" : ""
export const BG_BRIGHT_CYAN = isTTY ? "\x1b[106m" : ""
export const BG_BRIGHT_WHITE = isTTY ? "\x1b[107m" : ""

// Export a simple object for convenience (optional, not used elsewhere yet)
export const COLORS = {
	BLACK, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE,
	BRIGHT_BLACK, BRIGHT_RED, BRIGHT_GREEN, BRIGHT_YELLOW,
	BRIGHT_BLUE, BRIGHT_MAGENTA, BRIGHT_CYAN, BRIGHT_WHITE,
}

export const BG_COLORS = {
	BLACK: BG_BLACK,
	RED: BG_RED,
	GREEN: BG_GREEN,
	YELLOW: BG_YELLOW,
	BLUE: BG_BLUE,
	MAGENTA: BG_MAGENTA,
	CYAN: BG_CYAN,
	WHITE: BG_WHITE,
	BRIGHT_BLACK: BG_BRIGHT_BLACK,
	BRIGHT_RED: BG_BRIGHT_RED,
	BRIGHT_GREEN: BG_BRIGHT_GREEN,
	BRIGHT_YELLOW: BG_BRIGHT_YELLOW,
	BRIGHT_BLUE: BG_BRIGHT_BLUE,
	BRIGHT_MAGENTA: BG_BRIGHT_MAGENTA,
	BRIGHT_CYAN: BG_BRIGHT_CYAN,
	BRIGHT_WHITE: BG_BRIGHT_WHITE,
}
