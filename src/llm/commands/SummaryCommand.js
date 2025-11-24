import { RESET, GREEN, CYAN } from "../../utils/ANSI.js"
import Command from "./Command.js"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

/**
 * SummaryCommand – displays a short message in the output to maintain
 * important context in the chat sequence.
 *
 * The command accepts a message in its content:
 *   ```txt
 *   Key changes made:
 *   - Added new utility functions
 *   - Updated test suite
 *   ```
 */
export default class SummaryCommand extends Command {
	static name = "summary"
	static help = "Show short message in the output to keep important context"
	static example = "```txt\nKey changes made to the project:\n- Refactored utils\n- Added tests\n```"

	/** @type {ParsedFile} */
	parsed = {}

	/**
	 * @param {Partial<SummaryCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
		const { parsed = this.parsed } = input
		this.parsed = parsed
	}

	async * run() {
		const file = this.parsed.correct?.find((f) => f.filename === "@summary")
		if (!file) return

		const message = (file.content ?? "").trim()
		
		if (!message) {
			yield ` ${CYAN}ℹ${RESET} Empty summary`
			return
		}

		yield ` ${CYAN}ℹ${RESET} ${GREEN}Summary:${RESET}`
		for (const line of message.split("\n")) {
			yield `   ${line}`
		}
	}
}
