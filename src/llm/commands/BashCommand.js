import { RESET, YELLOW } from "../../utils/ANSI.js"
import Command from "./Command.js"

export default class BashCommand extends Command {
	static name = "bash"
	static help = "Run bash commands and save output of stdout & stderr in chat"
	/**
	 * @param {Partial<BashCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
	}
	async * run() {
		yield ` ${YELLOW}• Execute command:`
		yield ` •`
		yield ' • echo "```bash" > me.md'
		if (this.file.content) {
			const rows = this.file.content.split("\n")
			for (const row of rows) {
				yield ` • ${row} >> me.md 2>&1`
			}
		}
		yield ' • echo "```" >> me.md'
		yield RESET
	}
}
