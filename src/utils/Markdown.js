import FileProtocol, { FileEntry, FileError } from "../FileProtocol.js"

/** @typedef {import("../FileProtocol.js").ParsedFile} ParsedFile */

/**
 * MarkdownProtocol – parses markdown with file blocks into a structured format.
 */
export default class MarkdownProtocol extends FileProtocol {
	/**
	 * Process a single line of markdown input.
	 * @param {string} rawLine - The raw line to process
	 * @param {number} i - Current line number
	 * @param {FileEntry | null} current - Current file entry being processed
	 * @param {string | null} innerType - Current inner code block type
	 * @param {number} started - Line number where current file started
	 * @returns {{ nextCurrent: FileEntry | null, nextInnerType: string | null, nextStarted: number, entry: FileEntry | null }}
	 * @throws {FileError}
	 */
	static _processLine(rawLine, i, current, innerType, started) {
		let entry = null

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
					entry = current
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

		return { nextCurrent: current, nextInnerType: innerType, nextStarted: started, entry }
	}

	/**
	 * Parse the source into ParsedFile.
	 * @param {string} source – a source of content
	 * @returns {Promise<ParsedFile>}
	 */
	static async parse(source) {
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

		for (const rawLine of source.split("\n")) {
			++i
			try {
				const { nextCurrent, nextInnerType, nextStarted, entry } = this._processLine(
					rawLine, i, current, innerType, started
				)
				current = nextCurrent
				innerType = nextInnerType
				started = nextStarted
				if (entry) {
					correct.push(entry)
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
				const { nextCurrent, nextInnerType, nextStarted, entry } = this._processLine(
					rawLine, i, current, innerType, started
				)
				current = nextCurrent
				innerType = nextInnerType
				started = nextStarted
				if (entry) {
					correct.push(entry)
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
