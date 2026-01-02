import FileProtocol from "../FileProtocol.js"

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
 *   - `tasks` – an array of objects `{ label: string, link: string, text: string }`.
 */
export default class ReleaseProtocol extends FileProtocol {
	/**
	 * Parse a release‑notes markdown source.
	 *
	 * @param {string} source – markdown content of a release file.
	 * @returns {{ title: string, tasks: Array<{label:string, link:string, text:string}> }}
	 */
	static parse(source) {
		const lines = String(source).split("\n")
		let title = ""
		/** @type {Array<{label: string, link: string, text: string}>} */
		const tasks = []

		/** Regexp for a numbered task line */
		const taskRe = /^\s*\d+\.\s+\[([^\]]+)]\(([^)]+)\)\s*$/

		let i = 0
		while (i < lines.length) {
			const line = lines[i].trim()

			// ----- title -------------------------------------------------
			if (!title && line.startsWith("# ")) {
				title = line.slice(2).trim()
				i++
				continue
			}

			// ----- task --------------------------------------------------
			const match = line.match(taskRe)
			if (match) {
				const [, label, link] = match
				/** @type {string[]} */
				const descriptionLines = []
				i++ // move to the line after the task header

				// collect description until blank line or next task / heading
				while (i < lines.length) {
					const next = lines[i].trim()
					if (!next) break // empty line – end of description
					if (taskRe.test(next) || next.startsWith("#")) {
						// step back so outer loop sees the new task / heading
						i--
						break
					}
					descriptionLines.push(next)
					i++
				}
				const text = descriptionLines.join("\n").trim()
				tasks.push({ label, link, text })
				continue
			}

			i++
		}

		return { title, tasks }
	}

	/**
	 * Parse from stream.
	 * @param {import('node:readline').Interface} stream
	 * @returns {Promise<{ title: string, tasks: Array<{label:string, link:string, text:string}> }>}
	 */
	static async parseStream(stream) {
		let content = ""
		for await (const line of stream) {
			content += line + "\n"
		}
		return this.parse(content)
	}
}
