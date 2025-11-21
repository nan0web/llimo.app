import readline from "node:readline"

export class FileEntry {
	/** @type {string} */
	label = ""
	/** @type {string} */
	filename = ""
	/** @type {string} */
	type = ""
	/** @type {string} */
	content = ""
	/** @type {string} */
	encoding = "utf-8"
	/** @param {Partial<FileEntry>} */
	constructor(input = {}) {
		const {
			label = this.label,
			filename = this.filename,
			type = this.type,
			content = this.content,
			encoding = this.encoding,
		} = input
		this.label = String(label)
		this.filename = String(filename)
		this.type = String(type)
		this.content = String(content)
		this.encoding = String(encoding)
	}
}

export class FileError {
	/** @type {string | Error} */
	error = ""
	/** @type {string} */
	content = ""
	/** @type {number} */
	line = 0
	/** @param {Partial<FileError> | string} input */
	constructor(input = {}) {
		if ("string" === input) {
			input = { content: input }
		}
		const {
			error = this.error,
			content = this.content,
			line = this.line,
		} = input
		this.error = error instanceof Error ? error : String(error)
		this.content = String(content)
		this.line = Number(line)
	}
}

export default class FileProtocol {
	static async parse(source) {
		if ("string" === typeof source) {
			const stream = readline.createInterface({
				input: Readable.from([source]),
				crlfDelay: Infinity
			})
			return await this.parseStream(stream)
		}
	}
	/**
	 * @param {AsyncGenerator<string>} stream – an async iterator yielding one line per call.
	 * @returns {Promise<{ correct: FileEntry[], failed: FileError[] }>}
	 */
	static async parseStream(stream) {
		for await (const line of stream) { }
		return { correct: [], failed: [] }
	}
}
