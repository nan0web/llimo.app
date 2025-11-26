import { RESET, GREEN, RED, YELLOW } from "../../utils/ANSI.js"
import Command from "./Command.js"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

export default class ValidateCommand extends Command {
	static name = "validate"
	static label = "2 file(s), 1 command(s)"
	static help = "Validate of the response by comparing provided (parsed) files and commands to expected list of files and commands. Label is amount of files provided in the response and commands besides @validate provided in the response."
	static example = "```markdown\n- [](system.md)\n- [Updated](play/main.js)\n- [Setting up the project](@bash)\n```"

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
		const validateLabel = { files: 0, commands: 0 }
		String(this.parsed.validate?.label ?? "").split(", ").filter(Boolean).forEach(
			part => {
				const [no, t = "file(s)"] = part.split(" ")
				validateLabel["command(s)" === t ? "commands" : "files"] = Number(no)
			}
		)
		const commands = this.parsed.correct?.filter(
			file => file.filename.startsWith("@")
		).map(file => file.filename)
		const realLabel = { files: 0, commands: 0 }
		const files = Array.from(this.parsed.files ?? []).map(([file]) => {
			++realLabel[commands?.includes(file) ? "commands" : "files"]
			return file
		})
		const requested = Array.from(this.parsed.requested ?? []).map(([file]) => file)
		if (JSON.stringify(realLabel) !== JSON.stringify(validateLabel)) {
			yield `${YELLOW}! LLiMo following format errors ------------------------------`
			yield `  Unexpected response "${this.parsed.validate?.label}"`
			yield `  but provided (parsed response): ${realLabel.files} file(s), ${realLabel.commands} command(s)`
			yield `  ------------------------------------------------------------`
			yield `  ℹ label format for @validate is "#### [N file(s), M command(s)](@validate)"`
			yield `    where:`
			yield `      N - amount of file(s) minus command(s)`
			yield `      M - amount of commands(s) minus validate command (-1)`
			yield `    if amount is zero part with its number might be skipped`
			yield `  ------------------------------------------------------------${RESET}`
		}
		if (this.parsed.isValid) {
			yield ` ${GREEN}+${RESET} Expected validation of files ${GREEN}100% valid${RESET}`
		} else {
			yield ` ${RED}!${RESET} Validation of responses files fail`
			const PASS = `${GREEN}+`
			const FAIL = `${RED}-`
			if (requested.length) {
				yield `   Files to validate (LLiMo version):`
				for (const filename of requested) {
					yield `    ${files.includes(filename) ? PASS : FAIL} ${filename}${RESET}`
				}
			}
			if (files?.length) {
				console.error(`   Files parsed from the answer:`)
				for (const filename of files) {
					yield `    ${requested.includes(filename) ? PASS : FAIL} ${filename}${RESET}`
				}
			}
		}
	}
}
