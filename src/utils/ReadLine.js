import readline, { Interface } from 'node:readline'
import process from 'node:process'

import { BOLD, RESET } from './ANSI.js'

/**
 * Normalise the `stopKeys` option.
 *   - Accepts a string (“enter”) or an array of strings.
 *   - Returns an object {enter:Boolean, ctrl:Boolean, meta:Boolean}
 * @param {string | string[]} [stopKeys=[]]
 */
function parseStopKeys(stopKeys = []) {
	const set = new Set(Array.isArray(stopKeys) ? stopKeys : [stopKeys])
	return {
		enter: set.has('enter'),   // plain Enter
		ctrl: set.has('ctrl'),    // Ctrl+Enter
		meta: set.has('meta'),    // Cmd/Meta+Enter (macOS ⌘)
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
		const {
			input = process.stdin,
			output = process.stdout,
		} = options
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
		const stopKeys = parseStopKeys(options.stopKeys ?? []) // {enter, ctrl, meta}

		// --------------------------- 1️⃣ Enable key‑press events ---------------------------
		readline.emitKeypressEvents(stdin)
		if (stdin.isTTY) stdin.setRawMode(true)

		// --------------------------- 2️⃣ UI ----------------------------------------------------------------
		if (question) console.info(question)
		if (help) {
			console.info(`  • Type the stop word ${BOLD}${JSON.stringify(stopWord)}${RESET} on a line by itself`)
			console.info('  • OR press **Ctrl + Enter** (keep the cursor on an empty line, then press Ctrl+Enter)')
			console.info('--- start typing ---------------------------------------------------\n')
		}

		// --------------------------- 3️⃣ Collect data -------------------------------------------------
		const collected = []

		// -------------------------------------------------------------------------------
		// The Promise that will be returned
		// -------------------------------------------------------------------------------
		return new Promise((resolve) => {
			const rl = readline.createInterface({
				input: stdin,
				output: stdout,
				terminal: true,
				crlfDelay: Infinity,
			})

			// ----- 3️⃣1️⃣ Line events (stop‑word) -----------------------------------------
			rl.on('line', (rawLine) => {
				if (stopWord && rawLine.trim() === stopWord) {
					finish(rl)
					return
				}
				collected.push(rawLine)
			})

			// ----- 3️⃣2️⃣ Key‑press events (stop‑keys) ------------------------------------
			const onKeyPress = (str, key) => {
				// Debug – uncomment if you need to see every raw key:
				// console.log('KEY:', JSON.stringify(key))

				// ---- Plain Enter ---------------------------------------------------------
				if (key.name === 'return' && !key.ctrl && !key.meta) {
					if (stopKeys.enter) {
						// If we are on an *empty* line, we stop immediately.
						// If the user typed something, the line‑event above already stored it,
						// so we can safely finish.
						finish(rl)
						return
					}
				}

				// ---- Ctrl+Enter ----------------------------------------------------------
				// Unfortunately on most terminals Ctrl+Enter is transmitted as a
				// *control character* (`\x0d` with `ctrl:true`) **plus** a `return`
				// event.  The easiest way to catch it is to look for `key.ctrl && key.name === 'return'`.
				if (key.name === 'return' && key.ctrl) {
					if (stopKeys.ctrl) finish(rl)
					return
				}

				// ---- Cmd/Meta+Enter (macOS ⌘) --------------------------------------------
				if (key.name === 'return' && key.meta) {
					if (stopKeys.meta) finish(rl)
					return
				}

				// ---- If the user presses Ctrl+<letter> (e.g. Ctrl+S) we *ignore* it
				//      – it will appear as a control character (like '\x13') and is not a
				//      finishing command.  Nothing else needed.
			}

			// -------------------------------------------------------------------------------
			// Helper that resolves the Promise and restores the terminal.
			// -------------------------------------------------------------------------------
			const finish = (rlInstance) => {
				rlInstance.close()
				if (stdin.isTTY) stdin.setRawMode(false)
				stdin.removeListener('keypress', onKeyPress)
				resolve(collected.join('\n'))
			}

			// Attach the listener only once.
			stdin.on('keypress', onKeyPress)

			// ---------------------------------------------------------------------------
			// 4️⃣ Graceful abort on SIGINT (Ctrl‑C)
			// ---------------------------------------------------------------------------
			rl.on('SIGINT', () => {
				console.info('\n✋ Interrupted – exiting without returning data.')
				finish(rl)
				// Resolve with an empty string – you can change this behaviour if you want.
				resolve('')
			})
		})
	}

	/**
	 * Helper kept for backward compatibility – just forwards to `readline`
	 * @param {import('node:readline').ReadLineOptions} options
	 * @returns {Interface}
	 */
	createInterface(options) {
		return readline.createInterface(options)
	}
}
