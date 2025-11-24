import { FileEntry } from "../../FileProtocol.js"
import FileSystem from "../../utils/FileSystem.js"

export default class Command {
	static help = "Command description for user"
	static example = "The example of the content of the command response ```bash\npnpm install\n```"
	/** @type {string} */
	cwd = ""
	/** @type {FileSystem} */
	fs = new FileSystem()
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
			fs = this.fs,
		} = input
		this.cwd = String(cwd)
		this.timeout = Number(timeout)
		this.file = new FileEntry(file)
		this.fs = fs
	}
	/**
	 * @returns {AsyncGenerator<string>}
	 */
	async * run() {
		yield "Run method must be realized by subclasses"
	}
}
