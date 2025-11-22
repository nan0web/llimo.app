import readline from "node:readline"
import { Readable } from "node:stream"

/**
 * @typedef {Object} ParsedFile
 * @property {FileEntry[]} [correct=[]]
 * @property {FileError[]} [failed=[]]
 * @property {boolean} [isValid=false]
 * @property {FileEntry | null} [validate=null] Validate content with the list of provided files
 * @property {Array<[string, string]>} [files=[]] Array of found files in LLiMo response in [label, filename] format
 * @property {Array<[string, string]>} [requested=[]] Array of requested files in `@validate` file response from LLiMo in [label, filename] format
 */

/**
 * @typedef {Object} ValidateResult
 * @property {boolean} [isValid=false]
 * @property {FileEntry | null} [validate=null]
 * @property {Array<[string, string]>} [files=[]] Array of found files in LLiMo response in [label, filename] format
 * @property {Array<[string, string]>} [requested=[]] Array of requested files in `@validate` file response from LLiMo in [label, filename] format
 */

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
	/** @param {Partial<FileEntry>} [input={}] */
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
	/** @param {Partial<FileError>} input */
	constructor(input = {}) {
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
	/**
	 * Validates the correct array of file entries with the `@validate` filename.
	 * @param {FileEntry[]} correct
	 * @returns {ValidateResult}
	 */
	static validate(correct = []) {
		const validate = correct.filter(file => "@validate" === file.filename)[0]
		let isValid = false
		const requested = []
		let files = []
		if (validate) {
			files = correct.filter(file => "@validate" !== file.filename).map(
				file => [file.label, file.filename]
			)
			validate.content.split("\n").map(s => {
				if (!s.startsWith("- [") && !s.endsWith(")")) return ""
				requested.push(s.slice(3, -1).split("]("))
			}).filter(Boolean)
			isValid = JSON.stringify(files) === JSON.stringify(requested)
		}
		return { isValid, validate, files, requested }
	}

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
	 * @returns {Promise<ParsedFile>}
	 */
	static async parseStream(stream) {
		for await (const line of stream) { }
		return { correct: [], failed: [], isValid: false, validate: null }
	}
}
