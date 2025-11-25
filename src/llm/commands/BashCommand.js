import { RESET, YELLOW } from "../../utils/ANSI.js"
import Command from "./Command.js"

export default class BashCommand extends Command {
	static name = "bash"
	static help = "Run bash commands and save output of stdout & stderr in chat"
	static example = "```bash\npnpm install\n```"
	/**
	 * @param {Partial<BashCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
	}
	async * run() {
		yield ` ${YELLOW}• Execute command:`
		yield ` •`
		const PROMPT_FILE = "prompt.md"
		yield ' • echo "```bash" > ' + PROMPT_FILE
		if (this.file.content) {
			const rows = this.file.content.split("\n").map(s => s.trim()).filter(Boolean)
			for (const row of rows) {
				yield ` • ${row} >> ${PROMPT_FILE} 2>&1`
			}
		}
		yield ' • echo "```" >> ' + PROMPT_FILE + RESET
		yield ` •`
	}
}
