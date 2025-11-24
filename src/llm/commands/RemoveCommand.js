import { RESET, GREEN, RED, YELLOW } from "../../utils/ANSI.js"
import Command from "./Command.js"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

/**
 * RemoveCommand – removes files from the project (cwd).
 *
 * The command accepts file paths (one per line) in its content:
 *   ```txt
 *   dist/build.js
 *   temp/cache.tmp
 *   ```
 */
export default class RemoveCommand extends Command {
	static name = "rm"
	static help = "Remove files from the project (cwd)"
	static example = "```txt\ndist/build.js\ntemp/cache.tmp\n```"

	/** @type {ParsedFile} */
	parsed = {}

	/**
	 * @param {Partial<RemoveCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
		const { parsed = this.parsed } = input
		this.parsed = parsed
	}

	async * run() {
		const file = this.parsed.correct?.find((f) => f.filename === "@rm")
		if (!file) return

		// Parse file paths from content (one per line)
		const paths = (file.content ?? "")
			.trim()
			.split("\n")
			.map(p => p.trim())
			.filter(Boolean)

		if (paths.length === 0) {
			yield ` ${YELLOW}• No files specified for removal${RESET}`
			return
		}

		yield ` ${GREEN}• Removing files:${RESET}`

		for (const path of paths) {
			const absPath = resolve(this.cwd, path)
			try {
				// Check if file exists
				await fs.access(absPath)
				// Remove the file
				await fs.unlink(absPath)
				yield ` ${GREEN}+${RESET} Removed: ${path}`
			} catch (/** @type {any} */ error) {
				if (error.code === 'ENOENT') {
					yield ` ${YELLOW}!${RESET} Not found: ${path}`
				} else {
					yield ` ${RED}!${RESET} Failed to remove ${path}: ${error.message}`
				}
			}
		}
	}
}
