import readline, { Interface } from 'node:readline'
import process from 'node:process'

import { BOLD, RESET } from '../cli/ANSI.js'

/**
 * Normalise the `stopKeys` option.
 *   - Accepts a string (“enter”) or an array of strings.
 *   - Returns an object {enter:Boolean, ctrl:Boolean, meta:Boolean}
 * @param {string | string[]} [stopKeys=[]]
 */
function parseStopKeys(stopKeys = []) {
	const set = new Set(Array.isArray(stopKeys) ? stopKeys : [stopKeys])
	return {
		enter: set.has('enter'), // plain Enter
		ctrl: set.has('ctrl'),   // Ctrl+Enter
		meta: set.has('meta'),   // Cmd/Meta+Enter (macOS ⌘)
	}
}

/**
 * @typedef {Object} InteractiveReadLineOptions
 * @property {string}   [stopWord=""]         line that ends the input
 * @property {string[]|string} [stopKeys=[]]  which key‑combos finish the input
 * @property {string}   [question=""]         optional prompt printed before reading
 * @property {boolean}  [help=false]          print the “type # or Ctrl‑Enter” help text
 * @property {NodeJS.ReadableStream} [input]  defaults to process.stdin
 * @property {NodeJS.WritableStream} [output] defaults to process.stdout
 */

/**
 * A thin wrapper around Node's `readline` that supports:
 *   • a “stop word” line,
 *   • configurable key‑combos (Enter / Ctrl‑Enter / Cmd‑Enter),
 *   • optional help text,
 *   • graceful cleanup of raw mode.
 */
export default class ReadLine {
	/**
	 * @param {Object} [options] you can override the default stdin/stdout here.
	 */
	constructor(options = {}) {
		const { input = process.stdin, output = process.stdout } = options
		this.input = input
		this.output = output
	}

	/**
	 * Prompt the user and return everything they typed (joined with `\n`).
	 *
	 * @param {InteractiveReadLineOptions} options
	 * @returns {Promise<string>}
	 */
	async interactive(options = {}) {
		const stdin = options.input ?? this.input
		const stdout = options.output ?? this.output
		const stopWord = String(options.stopWord ?? '')
		const help = Boolean(options.help ?? false)
		const question = String(options.question ?? '')
		const stopKeys = parseStopKeys(options.stopKeys ?? [])

		// ------------------------------------------------- 1️⃣ enable key‑press events
		if (stdin.isTTY) {
			readline.emitKeypressEvents(stdin)
			stdin.setRawMode(true)
		}

		// ------------------------------------------------- 2️⃣ UI
		if (question) console.info(question)
		if (help) {
			console.info(
				`  • Type the stop word ${BOLD}${JSON.stringify(stopWord)}${RESET} on a line by itself`,
			)
			console.info(
				'  • OR press **Ctrl + Enter** (keep the cursor on an empty line, then press Ctrl+Enter)',
			)
			console.info('--- start typing ---------------------------------------------------\n')
		}

		// ------------------------------------------------- 3️⃣ collect data
		const collected = []

		return new Promise((resolve) => {
			const rl = readline.createInterface({
				input: stdin,
				output: stdout,
				terminal: true,
				crlfDelay: Infinity,
			})

			// ----- line (stop‑word) -----
			rl.on('line', (rawLine) => {
				if (stopWord && rawLine.trim() === stopWord) {
					finish()
					return
				}
				collected.push(rawLine)
			})

			// ----- key‑press (stop‑keys) -----
			const onKeyPress = (str, key) => {
				if (key.name === 'return' && !key.ctrl && !key.meta && stopKeys.enter) finish()
				if (key.name === 'return' && key.ctrl && stopKeys.ctrl) finish()
				if (key.name === 'return' && key.meta && stopKeys.meta) finish()
			}

			// ----- cleanup & resolve -----
			const finish = () => {
				rl.pause()
				if (stdin.isTTY) stdin.setRawMode(false)
				stdin.removeListener('keypress', onKeyPress)

				// Preserve trailing newline to match test expectations.
				const result = collected.length ? collected.join('\n') + '\n' : ''
				resolve(result)
			}

			// attach keypress listener only for TTY streams
			if (stdin.isTTY) stdin.on('keypress', onKeyPress)

			// ----- graceful abort (Ctrl‑C) -----
			rl.on('SIGINT', () => {
				console.info('\n✋ Interrupted – exiting without returning data.')
				finish()
				resolve('')
			})
		})
	}

	/**
	 * Backward‑compatible helper – forwards to `readline.createInterface`.
	 * @param {import('node:readline').ReadLineOptions} options
	 * @returns {Interface}
	 */
	createInterface(options) {
		return readline.createInterface(options)
	}
}
