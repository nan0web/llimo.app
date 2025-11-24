import Command from "./Command.js"
import micromatch from "micromatch"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"

/** @typedef {import("../../FileProtocol.js").ParsedFile} ParsedFile */

/**
 * GetFilesCommand – emits a checklist of files according to a request
 * that appears in the response as a `@get` block.
 *
 * The label part of the markdown reference can contain **minus patterns**
 * separated by semicolons, e.g.:
 *
 *   - [-**\/*.test.js;-**\/*.test.jsx](src/**)
 *
 * Due to the javascript comments \/ must be changed to / in real code.
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

	/** @type {ParsedFile} */
	parsed = {}

	/**
	 * @param {Partial<GetFilesCommand>} [input={}]
	 */
	constructor(input = {}) {
		super(input)
		const { parsed = this.parsed } = input
		this.parsed = parsed
	}

	/**
	 * Parse a label like `[-**\/*.test.js;-**\/*.test.jsx]` into an array
	 * of negative glob patterns.
	 * Due to the javascript comments \/ must be changed to / in real code.
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

	async _recursiveList(dir = this.cwd) {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		const files = []
		for (const entry of entries) {
			const full = resolve(dir, entry.name)
			if (entry.isDirectory()) {
				files.push(...(await this._recursiveList(full)))
			} else if (entry.isFile()) {
				files.push(full)
			}
		}
		return files
	}

	async _listFiles(baseGlob) {
		const all = await this._recursiveList()
		const matches = micromatch(all, baseGlob, { dot: true })
		return matches.map((abs) => this.fs.path.relative(this.cwd, abs))
	}

	async * run() {
		const file = this.parsed.correct?.find((f) => f.filename === "@get")
		if (!file) return

		// Extract user‑provided negative patterns.
		const userNegatives = this._negativePatterns(file.label || "")

		// Default ignores – always applied.
		const defaultNegatives = [".git/**", "node_modules/**"]

		const negatives = [...defaultNegatives, ...userNegatives]

		const baseGlob = (file.content ?? "**/*").trim()

		const all = await this._listFiles(baseGlob)
		const filtered = negatives.length ? micromatch.not(all, negatives) : all

		for (const relPath of filtered) {
			// Emit a checklist entry; empty label means default `[]`.
			yield `- [](${relPath})`
		}
	}
}
