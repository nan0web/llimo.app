import readline from "node:readline"
import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import process from "node:process"
import { dirname } from "node:path"

import { YELLOW, RED, RESET, GREEN, overwriteLine, DIM, stripANSI, ITALIC } from "./ANSI.js"
import Alert from "./components/Alert.js"
import Table from "./components/Table.js"

/** @typedef {"success" | "info" | "warn" | "error" | "debug" | "log"} LogTarget */

export class UiStyle {
	/** @type {number} */
	paddingLeft
	/**
	 * @param {Partial<UiStyle>} input
	 */
	constructor(input = {}) {
		const {
			paddingLeft = 0,
		} = input
		this.paddingLeft = Number(paddingLeft)
	}
}

export class UiFormats {
	/**
	 * Formats weight (size) of the value, available types:
	 * b - bytes
	 * f - files
	 * T - Tokens
	 * @param {"b" | "f" | "T"} type
	 * @param {number} value
	 * @param {(value: number) => string} [format]
	 * @returns {string}
	 */
	weight(type, value, format = new Intl.NumberFormat("en-US").format) {
		if ("b" === type) {
			return `${format(value)}b`
		}
		if ("f" === type) {
			return `${format(value)}f`
		}
		if ("T" === type) {
			return `${format(Math.floor(value))}T`
		}
		return String(value)
	}
	/**
	 * Formats count (amount) of the value
	 * @param {number} value
	 * @param {(value: number) => string} [format]
	 * @returns {string}
	 */
	count(value, format = new Intl.NumberFormat("en-US").format) {
		return format(value)
	}
	/**
	 * @param {number} value
	 * @param {number} [digits=2]
	 * @returns {string}
	 */
	pricing(value, digits = 4) {
		// Use currency style to ensure the $ sign and correct negative formatting.
		const options = {
			style: 'currency',
			currency: "USD",
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		}
		return new Intl.NumberFormat("en-US", options).format(value)
	}
	/**
	 * Formats money in USD with currency symbol and six decimals by default.
	 * Delegates to pricing to keep consistent formatting.
	 * @param {number} value
	 * @param {number} [digits=6]
	 * @returns {string}
	 */
	money(value, digits = 4) {
		return this.pricing(value, digits)
	}
	/**
	 * Formats timer elapsed in mm:ss.s format, caps at 3600s+.
	 * @param {number} elapsed - Seconds elapsed.
	 * @returns {string}
	 */
	timer(elapsed) {
		// if (elapsed > 3600) elapsed = 3600
		const mins = Math.floor(elapsed / 60)
		const secs = Math.floor(elapsed % 60)
		return `${mins}:${secs.toString().padStart(2, "0")}`
	}
	/**
	 * Returns a colored LEFT tokens count of TOTAL.
	 * @param {number} count
	 * @param {number} context_length
	 * @returns {string}
	 */
	leftTokens(count, context_length) {
		return [
			ITALIC,
			count > context_length / 2 ? GREEN
				: count > context_length / 4 ? YELLOW
					: RED,
			this.weight("T", count), RESET,
			" of ", ITALIC,
			this.weight("T", context_length), RESET,
		].join("")
	}
}

export class UiConsole {
	/** @type {Console} Console implementation to delegate to. */
	console
	/** @type {boolean} Enable/disable debug output. */
	debugMode = false
	/** @type {string|undefined} Path to a log file; if omitted logging is disabled. */
	logFile
	/** @type {string} Prefix for .info() */
	prefixedStyle = ""
	stdout = process.stdout

	/**
	 * @param {Partial<UiConsole>} [options={}]
	 */
	constructor(options = {}) {
		const {
			console: uiConsole = console,
			stdout = this.stdout,
			debugMode = this.debugMode,
			logFile = this.logFile,
			prefixedStyle = this.prefixedStyle,
		} = options
		this.console = uiConsole
		this.stdout = stdout
		this.debugMode = debugMode
		this.logFile = logFile
		this.prefixedStyle = String(prefixedStyle)
	}

	/**
	 * Append a message to the log file if logging is enabled.
	 *
	 * @private
	 * @param {LogTarget} target
	 * @param {string} msg
	 */
	appendFile(target, msg) {
		if (!this.logFile) return
		const time = new Date().toISOString().slice(0, 16)
		if (!existsSync(this.logFile)) {
			mkdirSync(dirname(this.logFile), { recursive: true })
		}
		appendFileSync(this.logFile, `${time} [${target}] ${msg}\n`)
	}

	/**
	 * Set's the prefix such as color before every message in .info method.
	 * @param {string} prefix
	 */
	style(prefix = RESET) {
		this.prefixedStyle = prefix
	}

	/**
	 * @todo write jsdoc
	 * @param {any[]} args
	 * @returns {{ styles: UiStyle[], args: any[] }}
	 */
	extractStyles(args = []) {
		const styles = []
		let rest = []
		args.forEach(el => {
			if (el instanceof UiStyle) {
				styles.push(el)
			} else {
				rest.push(el)
			}
		})
		let combined = {}
		styles.forEach(s => combined = { ...combined, ...s })
		Object.entries(new UiStyle(combined)).forEach(([name, value]) => {
			if ("paddingLeft" === name) {
				const spaces = " ".repeat(Number(value))
				rest = rest.map(s => String(s).split("\n").map(l => `${spaces}${l}`).join("\n"))
			}
		})
		return { styles, args: rest }
	}

	/**
	 * @todo write jsdoc
	 * @param {any[]} args
	 * @returns {string}
	 */
	extractMessage(args = []) {
		const { args: words } = this.extractStyles(args)
		return words.join(" ")
	}

	/**
	 * Output a debug message when debug mode is enabled.
	 *
	 * @param {...any} args
	 */
	debug(...args) {
		if (!this.debugMode) return
		const msg = this.extractMessage(args)
		this.console.debug(DIM + msg + RESET)
		this.appendFile("debug", msg)
	}

	/** @param {...any} args */
	info(...args) {
		const msg = this.prefixedStyle + this.extractMessage(args) + RESET
		this.console.info(msg)
		this.appendFile("info", msg)
	}

	/** @param {...any} args */
	log(...args) {
		const msg = this.extractMessage(args)
		this.console.log(msg)
		this.appendFile("log", msg)
	}

	/** @param {...any} args */
	warn(...args) {
		const msg = YELLOW + this.extractMessage(args) + RESET
		this.console.warn(msg)
		this.appendFile("warn", msg)
	}

	/** @param {...any} args */
	error(...args) {
		const msg = RED + this.extractMessage(args) + RESET
		this.console.error(msg)
		this.appendFile("error", msg)
	}

	/** @param {...any} args */
	success(...args) {
		const msg = GREEN + this.extractMessage(args) + RESET
		// Use this.console.info to match test expectations
		this.console.info(msg)
		this.appendFile("success", msg)
	}

	/**
	 * @todo write jsdoc
	 * @param {string} line
	 * @param {string} [space=" "]
	 * @returns {string}
	 */
	full(line, space = " ") {
		const [w, h] = this.stdout.getWindowSize?.() ?? [120, 30]
		if (line.length > w) line = line.slice(0, w - 1) + "…"
		if (line.length < w) line += space.repeat(w - line.length)
		return line
	}


	/**
	 * @todo cover with tests.
	 * @param {any[][]} rows
	 * @param {{divider?: string | number, aligns?: string[], silent?: boolean, overflow?: "visible" | "hidden"}} [options={}]
	 * @returns {string[]}
	 */
	table(rows = [], options = {}) {
		const { divider = " | ", aligns = [], silent = false, overflow = "visible" } = options
		const div = "number" === typeof divider ? " ".repeat(divider) : divider

		// Determine column widths based on visible (ANSI‑stripped) length
		const colWidths = []
		rows.forEach(row => {
			row.forEach((cell, j) => {
				const visible = stripANSI(String(cell)).trim().length
				colWidths[j] = Math.max(colWidths[j] ?? 0, visible)
			})
		})

		// Build formatted lines respecting alignment
		const lines = rows.map(row =>
			row.map((cell, j) => {
				const raw = String(cell).trim()
				const visible = stripANSI(raw).trim().length
				const pad = colWidths[j] - visible
				const align = aligns[j] ?? "left"
				if (align === "right") {
					return " ".repeat(pad) + raw
				}
				// default "left"
				return raw + " ".repeat(pad)
			}).join(div)
		)

		// Emit to the wrapped console and return the lines
		if (!silent) lines.forEach(
			l => this.console.info("hidden" === overflow ? this.full(l) : l)
		)
		return lines
	}
}

export class UiCommand {
	/**
	 * Creates Alert instance for the Ui output.
	 * @param {Partial<Alert>} input
	 * @returns {Alert}
	 */
	createAlert(input) {
		return new Alert(input)
	}
	/**
	 * @param {import("./components/Alert.js").AlertVariant} [variant='info']
	 * @returns {(input: Partial<Alert>) => Alert}
	 */
	createAlerter(variant = "info") {
		return (input) => {
			if ("string" === typeof input) {
				input = { text: input }
			}
			return this.createAlert({ variant, ...input })
		}
	}
	/**
	 * Creates Table instance for the Ui output.
	 * @param {Partial<Table>} input
	 * @returns {Table}
	 */
	createTable(input) {
		return new Table(input)
	}
}

/**
 * UI helper for CLI interactions.
 *
 * @class
 */
export class Ui {
	/** @type {boolean} */
	debugMode = false
	/** @type {string|null} */
	logFile = null

	/** @type {NodeJS.ReadStream} */
	stdin = process.stdin
	/** @type {NodeJS.WriteStream} */
	stdout = process.stdout
	/** @type {NodeJS.WriteStream} */
	stderr = process.stderr

	/** @type {UiConsole} */
	console
	/** @type {UiFormats} UiFormats instance to format numbers, if omitted new UiFormats() is used. */
	formats = new UiFormats()

	/**
	 * @param {Partial<Ui>} [options={}]
	 */
	constructor(options = {}) {
		const {
			debugMode = this.debugMode,
			logFile = this.logFile,
			stdin = this.stdin,
			stdout = this.stdout,
			stderr = this.stderr,
			console,
			formats = this.formats,
		} = options
		this.debugMode = Boolean(debugMode)
		this.logFile = String(logFile)
		this.stdin = stdin
		this.stdout = stdout
		this.stderr = stderr
		this.console = console instanceof UiConsole ? console
			: new UiConsole({
				debugMode: this.debugMode,
				stdout: /** @type {any} */ (stdout), ...(console ?? {})
			})
		this.formats = formats
	}

	/**
	 * Get debug mode status.
	 *
	 * @returns {boolean}
	 */
	get isDebug() {
		return this.debugMode
	}

	/**
	 * Set debug mode and optionally specify a log file.
	 *
	 * @param {boolean} debug
	 * @param {string|null} [logFile=null]
	 */
	setup(debug = false, logFile = null) {
		this.debugMode = debug
		this.logFile = logFile
	}

	/**
	 * Move the cursor up by a number of lines.
	 *
	 * @param {number} [lines=1]
	 */
	cursorUp(lines = 1) {
		this.stdout.write(`\x1b[${lines}A`)
	}

	/**
	 * Overwrite the current line with the given text.
	 *
	 * @param {string} line
	 */
	overwriteLine(line) {
		this.stdout.write(overwriteLine(line))
	}

	/**
	 * Writes to stdout.
	 * @param {Buffer | DataView | Error | string} buffer
	 * @param {(err?: Error | undefined) => void} [cb]
	 */
	write(buffer, cb = () => { }) {
		if (buffer instanceof Error) buffer = (this.isDebug ? buffer.stack ?? buffer.message : buffer.message) || ""
		this.stdout.write(String(buffer), cb)
	}

	/**
	 * Prompt the user with a question and resolve with the answer.
	 *
	 * @param {string} question
	 * @returns {Promise<string>}
	 */
	async ask(question) {
		const rl = readline.createInterface({
			input: this.stdin,
			output: this.stdout,
			terminal: true,
		})
		return new Promise(resolve => {
			rl.question(question, ans => {
				rl.close()
				resolve(ans)
			})
		})
	}

	/**
	 * Prompt a yes/no question.
	 *
	 * Returns `"yes"` for an affirmative answer, `"no"` for a negative answer,
	 * and the raw answer string if it does not match those expectations.
	 *
	 * @param {string} question
	 * @returns {Promise<"yes" | "no" | string>}
	 */
	async askYesNo(question) {
		const answer = await this.ask(question)
		const lower = String(answer).trim().toLocaleLowerCase()
		if (["yes", "y", ""].includes(lower)) return "yes"
		if (["no", "n"].includes(lower)) return "no"
		return answer
	}

	/**
	 * Create progress interval to call the fn() with provided fps.
	 *
	 * @typedef {Object} ProgressFnInput
	 * @property {number} elapsed
	 * @property {number} startTime
	 *
	 * @param {(input: ProgressFnInput) => void} fn
	 * @param {number} [startTime]
	 * @param {number} [fps]
	 * @returns {NodeJS.Timeout}
	 */
	createProgress(fn, startTime = Date.now(), fps = 33) {
		return setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1e3
			fn({ elapsed, startTime })
		}, 1e3 / fps)
	}

	/**
	 * @todo write jsdoc
	 * @param {Object} options
	 * @param {number} [options.paddingLeft]
	 * @returns {UiStyle}
	 */
	createStyle(options = {}) {
		return new UiStyle(options)
	}
}

export default Ui

