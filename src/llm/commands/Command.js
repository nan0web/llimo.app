import { FileEntry } from "../../FileProtocol.js"

export default class Command {
	static help = "Command description for user"
	/** @type {string} */
	cwd = ""
	/** @type {number} */
	timeout = 0
	/** @type {FileEntry} */
	file = new FileEntry()
	/**
	 * @param {Partial<Command>} input
	 */
	constructor(input = {}) {
		const {
			cwd = this.cwd,
			timeout = this.timeout,
			file = this.file,
		} = input
		this.cwd = String(cwd)
		this.timeout = Number(timeout)
		this.file = new FileEntry(file)
	}
	/**
	 * @returns {AsyncGenerator<string>}
	 */
	async * run() {
		yield "Run method must be realized by subclasses"
	}
}
