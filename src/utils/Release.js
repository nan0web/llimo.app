/**
 * ReleaseProtocol – parses release‑notes markdown into a concise JSON structure.
 *
 * Expected markdown shape:
 *   # <title>
 *
 *   1. [<label>](<link>)
 *      <description text …>
 *
 *   (repeated for each task)
 *
 * The parser extracts:
 *   - `title` – the first level‑1 heading.
 *   - `tasks` – an array of objects `{ label, link, text }`.
 *
 * @class
 */
export default class ReleaseProtocol {
	/** @type {string} */
	version = ""
	/** @param {Partial<ReleaseProtocol>} [input={}] */
	constructor(input = {}) {
		const {
			version = this.version,
		} = input
		this.version = String(version)
	}
	get x() {
		let [x] = this.version.split(".")
		return x.startsWith("v") ? x.slice(1) : x
	}
	get y() {
		let [, y] = this.version.split(".")
		return y.startsWith("v") ? y.slice(1) : y
	}
	get z() {
		let [, , z] = this.version.split(".")
		return z.startsWith("v") ? z.slice(1) : z
	}
	/**
	 * Parse a release‑notes markdown source.
	 *
	 * @param {string} source – markdown content of a release file.
	 * @returns {{ title: string, tasks: Array<{label:string, link:string, text:string}> }}
	 */
	static parse(source) {
		const lines = String(source).split("\n")
		let title = ""
		const tasks = []

		/** Regexp for a numbered task line */
		const taskRe = /^\s*\d+\.\s+\[([^\]]+)]\(([^)]+)\)\s*$/

		/** Helper – determine if a line starts a new task */
		const isTaskLine = line => taskRe.test(line)

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// ----- title -------------------------------------------------
			if (!title && line.startsWith("# ")) {
				title = line.slice(2).trim()
				continue
			}

			// ----- task --------------------------------------------------
			const match = line.match(taskRe)
			if (match) {
				const [, label, link] = match
				const descriptionLines = []
				i++ // move to the line after the task header

				// collect description until blank line or next task / heading
				for (; i < lines.length; i++) {
					const next = lines[i]
					if (!next.trim()) break // empty line – end of description
					if (isTaskLine(next) || next.startsWith("#")) {
						// step back so outer loop sees the new task / heading
						i--
						break
					}
					descriptionLines.push(next.trim())
				}
				const text = descriptionLines.join("\n").trim()
				tasks.push({ label, link, text })
			}
		}

		return { title, tasks }
	}
}
