import Command from "./Command.js"
import micromatch from "micromatch"
import { promises as fs } from "node:fs"
import { resolve, relative } from "node:path"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

/**
 * GetFilesCommand – emits a checklist of files according to a request
 * that appears in the response as a `@get` block.
 *
 * The label part of the markdown reference can contain **minus patterns**
 * separated by semicolons, e.g.:
 *
 *   - [-**\/*.test.js;-**\/*.test.jsx](@get)
 *
 * Positive part (the path inside parentheses) is the base glob.
 * Negative patterns (prefixed with `-`) are applied to filter the result.
 * Default ignore patterns `.git/**` and `node_modules/**` are always applied
 * unless they are explicitly overridden.
 */
export default class GetFilesCommand extends Command {
	static name = "get"
	static help = "Get the files from the project one file or pattern per line (including micromatch patterns)"
	static example = "```\nsrc/index.js\ntypes/**\npackage.json\n```"

	/**
	 * Parse a label like `[-**\/*.test.js;-**\/*.test.jsx]` into an array
	 * of negative glob patterns.
	 *
	 * @param {string} label
	 * @returns {string[]}
	 */
	_negativePatterns(label) {
		const clean = label.replace(/^\[|\]$/g, "")
		return clean
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.startsWith("-"))
			.map((s) => s.slice(1))
	}

	/**
	 * Recursively list all files in a directory, respecting ignore patterns
	 * @param {string} dir - Directory to scan (absolute path)
	 * @param {string[]} ignorePatterns - Patterns to ignore
	 * @returns {Promise<string[]>} - Array of relative file paths
	 */
	async _recursiveList(dir = this.cwd, ignorePatterns = []) {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		const files = []

		for (const entry of entries) {
			const fullPath = resolve(dir, entry.name)
			const relPath = relative(this.cwd, fullPath)

			// Check if this path matches any ignore pattern
			if (ignorePatterns.length > 0 && micromatch.isMatch(relPath, ignorePatterns, { dot: true })) {
				continue
			}

			if (entry.isDirectory()) {
				// Recurse into subdirectories
				files.push(...(await this._recursiveList(fullPath, ignorePatterns)))
			} else if (entry.isFile()) {
				files.push(relPath)
			}
		}
		return files
	}

	async * run() {
		const file = this.parsed.correct?.find((f) => f.filename === "@get")
		if (!file) return

		// Extract user-provided negative patterns from label
		const userNegatives = this._negativePatterns(file.label || "")

		// Default ignores – always applied unless overridden
		const defaultNegatives = [".git/**", "node_modules/**"]

		// Combine all negative patterns
		const negatives = [...defaultNegatives, ...userNegatives]

		// Parse content - can be multiple lines with different patterns
		const patterns = (file.content ?? "**/*")
			.trim()
			.split("\n")
			.map(p => p.trim())
			.filter(Boolean)

		// Get all files (with ignore patterns applied)
		const allFiles = await this._recursiveList(this.cwd, negatives)

		// Apply positive patterns to filter the results
		let matched = []
		if (patterns.includes("**/*") || patterns.length === 0) {
			matched = allFiles
		} else {
			matched = micromatch(allFiles, patterns, { dot: true })
		}

		// Sort for consistent output
		matched.sort()

		// Emit checklist entries
		for (const relPath of matched) {
			yield `- [](${relPath})`
		}
	}
}
