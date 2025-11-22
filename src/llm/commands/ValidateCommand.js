import { RESET, GREEN, RED } from "../../utils/ANSI.js"
import Command from "./Command.js"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

export default class ValidateCommand extends Command {
	static name = "validate"
	static help = "Check the validation "

	/** @type {ParsedFile} */
	parsed = {}
	/**
	 * @param {Partial<ValidateCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
		const {
			parsed = this.parsed,
		} = input
		this.parsed = parsed
	}
	async * run() {
		if (this.parsed.isValid) {
			yield ` ${GREEN}+${RESET} Expected validation of files 100% valid`
		} else {
			yield ` ${RED}-${RESET} ! Validation of responses files fail`
			if (this.parsed.requested?.length) {
				yield `   Files to validate (LLiMo version):`
				for (const [label, filename] of this.parsed.requested) {
					yield `   - [${label}](${filename})`
				}
			}
			if (this.parsed.files?.length) {
				console.error(`   Files parsed from the answer:`)
				for (const [label, filename] of this.parsed.files) {
					yield `   - [${label}](${filename})`
				}
			}
		}
	}
}
