import readline from "node:readline"
import { Readable } from "node:stream"

/**
 * @typedef {Object} ParsedFile
 * @property {FileEntry[]} [correct=[]] List of correctly parsed files from the response
 * @property {FileError[]} [failed=[]] List of errors per line detected in the response
 * @property {boolean} [isValid=false] Validation flag that checked by LLiMo validate files compared to delivered files in the response
 * @property {FileEntry | null} [validate=null] Validate content with the list of provided files
 * @property {Map<string, string>} [files=new Map()] Map<filename, label> of found files in LLiMo response in [label, filename] format
 * @property {Map<string, string>} [requested=new Map()] Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
 */

/**
 * @typedef {Object} ValidateResult
 * @property {boolean} [isValid=false] Validation flag that checked by LLiMo validate files compared to delivered files in the response
 * @property {FileEntry | null} [validate=null] Validate file with the content of the listed files that LLiMo thinks must be delivered in the response
 * @property {Map<string, string>} [files=new Map()] Map<filename, label> of found files in LLiMo response in [label, filename] format
 * @property {Map<string, string>} [requested=new Map()] Map<filename, label> of requested files in `@validate` file response from LLiMo in [label, filename] format
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

export class FileProtocol {
	/**
	 * Validates the correct array of file entries with the `@validate` filename.
	 * @param {FileEntry[]} correct
	 * @returns {ValidateResult}
	 */
	static validate(correct = []) {
		const validate = correct.filter(file => "@validate" === file.filename)[0]
		let isValid = false
		const requested = []
		/** @type {readonly (readonly [any, any])[] | null} */
		let files = []
		files = correct.filter(file => "@validate" !== file.filename).map(
			file => [file.filename, file.label]
		)
		const a = files.map(([f]) => f).sort()
		if (validate) {
			validate.content.split("\n").map(s => {
				if (!s.startsWith("- [") && !s.endsWith(")")) return ""
				const [label, name = ""] = s.slice(3, -1).split("](")
				requested.push([name, label])
			}).filter(Boolean)
			const b = requested.map(([f]) => f).sort()
			/**
			 * @description labels are not important for validation of files compare
			 */
			isValid = JSON.stringify(a) === JSON.stringify(b)
		}
		return { isValid, validate, files: new Map(files), requested: new Map(requested) }
	}

	/**
	 * Parse the source into ParsedFile.
	 * @param {any} source – a source of content
	 * @returns {Promise<ParsedFile>}
	 */
	static async parse(source) {
		const stream = readline.createInterface({
			input: Readable.from([String(source)]),
			crlfDelay: Infinity
		})
		return await this.parseStream(stream)
	}

	/**
	 * @param {AsyncGenerator<string> | import("node:readline").Interface} stream – an async iterator yielding one line per call.
	 * @returns {Promise<ParsedFile>}
	 */
	static async parseStream(stream) {
		for await (const line of stream) { }
		return { correct: [], failed: [], isValid: false, validate: null }
	}
}
