import process from "node:process"
import readline from "node:readline"
import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import { YELLOW, RED, RESET, GREEN, overwriteLine, DIM, stripANSI, ITALIC } from "./ANSI.js"
import { UiOutput } from "./UiOutput.js"
import { Alert, Table, Progress } from "./components/index.js"

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
	 * @param {number} [digits=4]
	 * @returns {string}
	 */
	pricing(value, digits = 4) {
		/** @type {Intl.NumberFormatOptions} */
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
	 * @param {number} [digits=4]
	 * @returns {string}
	 */
	money(value, digits = 4) {
		return this.pricing(value, digits)
	}
	/**
	 * Formats timer elapsed in mm:ss.s format, caps at 3600s+.
	 * @param {number} elapsed - Milliseconds elapsed.
	 * @returns {string}
	 */
	timer(elapsed) {
		const s = Math.round(elapsed / 1e3)
		const mins = Math.floor(s / 60)
		const secs = Math.floor(s % 60)
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
		this.console.info(msg)
		this.appendFile("success", msg)
	}

	/**
	 * @todo write jsdoc
	 * @param {string} line
	 * @param {string} [space=" "]
	 * @param {string} [more="…"]
	 * @returns {string}
	 */
	full(line, space = " ", more = "…") {
		const [w] = this.stdout.getWindowSize?.() ?? [120, 30]
		if (line.length > w) line = line.slice(0, w - 1) + more
		if (line.length < w) line += space.repeat(w - line.length)
		return line
	}

	/**
	 * Progress bar string.
	 * @param {number} i
	 * @param {number} len
	 * @param {number} [width=33]
	 * @param {string} [on="="]
	 * @param {string} [off=" "]
	 * @returns {string}
	 */
	bar(i, len, width = 33, on = "=", off = " ") {
		const total = Math.max(1, Number(len) || 0)
		const ratio = Math.max(0, Math.min(1, Number(i) / total))
		const filled = Math.round(width * ratio)
		return on.repeat(filled) + off.repeat(Math.max(0, width - filled))
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

		const colWidths = []
		rows.forEach(row => {
			row.forEach((cell, j) => {
				const visible = stripANSI(String(cell)).trim().length
				colWidths[j] = Math.max(colWidths[j] ?? 0, visible)
			})
		})

		const lines = rows.map(row =>
			row.map((cell, j) => {
				const raw = String(cell).trim()
				const visible = stripANSI(raw).trim().length
				const pad = colWidths[j] - visible
				const align = aligns[j] ?? "left"
				if (align === "right") {
					return " ".repeat(pad) + raw
				}
				return raw + " ".repeat(pad)
			}).join(div)
		)

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
	/** @type {string[]} */
	progressFrame = []
	/** @type {UiFormats} UiFormats instance to format numbers, if omitted new UiFormats() is used. */
	formats = new UiFormats()

	/** @type {string[]} Queue of predefined stdin values (if STDIN env var is set). */
	definedInputs = []

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
			definedInputs = this.definedInputs,
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

		const raw = process.env.STDIN ?? ""
		const normalized = raw.replace(/\\n/g, "\n")
		this.definedInputs = normalized ? normalized.split("\n") : definedInputs
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
	 * Progress bar helper.
	 *
	 * @param {number} i
	 * @param {number} len
	 * @param {number} [width=33]
	 * @param {string} [on="="]
	 * @param {string} [off=" "]
	 * @returns {string}
	 */
	bar(i, len, width = 33, on = "=", off = " ") {
		return this.console.bar(i, len, width, on, off)
	}

	/**
	 * Writes to stdout.
	 * @param {Buffer | DataView | Error | string} buffer
	 * @param {(err?: Error | null | undefined) => void} [cb]
	 */
	write(buffer, cb = () => { }) {
		if (buffer instanceof Error) buffer = (this.isDebug ? buffer.stack ?? buffer.message : buffer.message) || ""
		this.stdout.write(String(buffer), cb)
	}

	/**
	 * Prompt the user with a question and resolve with the answer.
	 *
	 * If predefined STDIN values are supplied via the STDIN environment variable,
	 * the next value from that queue is returned without asking the user.
	 *
	 * @param {string} question
	 * @returns {Promise<string>}
	 */
	async ask(question) {
		if (this.definedInputs.length) {
			const next = this.definedInputs.shift() ?? ""
			this.console.info(question + next)
			return next
		}
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
	 * @property {number} elapsed elapsed seconds
	 * @property {number} startTime start timestamp ms
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

	/**
	 * Renders the element
	 * @param {UiOutput} element
	 */
	render(element) {
		if (element instanceof Alert) {
			if (element.variant in this.console) {
				this.console[element.variant](element.text)
			}
			else {
				this.console.info(element.text)
			}
		}
		else if (element instanceof Table) {
			this.console.table(Table.normalizeRows(element.rows), element.options)
		}
		else if (element instanceof Progress) {
			const str = String(element)
			this.cursorUp(this.progressFrame.length)
			this.progressFrame = str.split("\n").map(s => this.console.full(s))
			this.console.info("\r" + this.progressFrame.join("\n"))
		}
	}
}

