import FileProtocol, { FileEntry, FileError } from "../FileProtocol.js"

/** @typedef {import("../FileProtocol.js").ParsedFile} ParsedFile */

export default class MardownProtocol extends FileProtocol {
	/**
	 * @param {AsyncGenerator<string>} stream – an async iterator yielding one line per call.
	 * @returns {Promise<ParsedFile>}
	 */
	static async parseStream(stream) {
		/** @type {FileEntry[]} */
		const correct = []
		/** @type {FileError[]} */
		const failed = []
		/** @type {FileEntry | null} */
		let current = null
		/** @type {string | null} */
		let innerType = null
		let started = 0
		let i = 0
		for await (const rawLine of stream) {
			++i
			try {
				if (null === current) {
					if (rawLine.startsWith("#### [") && rawLine.endsWith(")") && rawLine.includes("](")) {
						const [first, second, nothing] = rawLine.split("](")
						if (undefined === nothing && "string" === typeof second) {
							// it is file header
							const label = first.slice(6)
							const filename = second.slice(0, -1)
							current = new FileEntry({ label, filename })
							started = i
						} else {
							throw new FileError({ line: i, content: rawLine, error: "Incorrect file header" })
						}
					} else {
						throw new FileError({ line: i, content: rawLine, error: "Content beyond file" })
					}
				} else {
					if ("```" === rawLine) {
						if (started + 1 === i) {
							// starting the code without a type
							current.type = ""
						} else {
							correct.push(current)
							current = null
							started = 0
						}
					} else if (rawLine.startsWith("```") && !rawLine.startsWith("````")) {
						current.type = rawLine.trim().slice(3)
					} else if (rawLine.startsWith("````")) {
						if (null === innerType) {
							const nextIndex = Array.from(rawLine).findIndex(s => s !== "`")
							innerType = rawLine.trim().slice(nextIndex)
							current.content += "```" + innerType + "\n"
						} else {
							innerType = null
							current.content += "```"
						}
					} else {
						current.content += rawLine + "\n"
					}
				}
			} catch (/** @type {any} */ err) {
				failed.push(err)
			}
		}
		if (current) {
			correct.push(current)
		}
		const { isValid, validate, files, requested } = FileProtocol.validate(correct)
		return { correct, failed, isValid, validate, files, requested }
	}
}
