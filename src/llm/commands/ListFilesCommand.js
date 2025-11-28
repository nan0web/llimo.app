import micromatch from "micromatch"
import Command from "./Command.js"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

export default class ListFilesCommand extends Command {
	static name = "ls"
	static help = "List the files inside project one directory or pattern per line (including micromatch patterns)"
	static example = "```\ntypes\nsrc/**/*.test.js\n```"

	async * run() {
		const file = this.parsed.correct?.filter(file => "@ls" === file.filename)[0]
		const patterns = String(file?.content || ".").trim().split("\n").map(p => p.trim()).filter(Boolean)

		const allFiles = await this.#getAllFiles(this.cwd)
		let matched = []
		if (patterns.length === 0 || (patterns.length === 1 && patterns[0] === '.')) {
			matched = allFiles
		} else {
			matched = micromatch(allFiles, patterns, { dot: true })
		}

		matched.sort()
		for (const relPath of matched) {
			if (!relPath.endsWith("/")) {
				yield relPath
			}
		}
	}

	/**
	 * Recursively list all files in a directory
	 * @param {string} dir - Directory to scan (absolute path)
	 * @returns {Promise<string[]>} - Array of relative file paths
	 */
	async #getAllFiles(dir = this.cwd, ignore = ['.git/**', 'node_modules/**']) {
		return await this.fs.browse(dir, { recursive: true, ignore })
	}
}

