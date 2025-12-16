import { parseArgv } from "../../cli/argvHelper.js"
import Chat from "../../llm/Chat.js"
import { InfoCommand } from "./info.js"

/**
 * Options for the `info` command.
 */
export class TestOptions {
	/** @type {string} */
	id
	static id = {
		help: "Chat ID (optional), if not provided current will be used",
		default: ""
	}
	/** @type {string} */
	testDir
	static testDir = {
		alias: "test-dir",
		default: ""
	}
	constructor(input = {}) {
		const {
			id = TestOptions.id.default,
			testDir = TestOptions.testDir.default,
		} = input
		this.id = String(id)
		this.testDir = String(testDir)
	}
}

/**
 * `test` command – shows a table with per‑message statistics and a total line.
 *
 * Columns:
 *   - **Role** – system / user / assistant / tool
 *   - **Files** – number of attached files (detected via markdown checklist)
 *   - **Bytes** – raw byte size of the message content
 *   - **Tokens** – estimated token count (≈ 1 token per 4 bytes)
 *
 * After printing the table, the command yields `false` so the CLI code knows it can
 * continue with the normal chat loop.
 */
export class TestCommand extends InfoCommand {
	static name = "test"
	static help = "Show information of the chat before tests run"
	options = new TestOptions()
	async * run() {
		await this.chat.init()
		if (!this.chat.id) {
			throw new Error("Provide Chat ID")
		}
		// @todo create a tenporary directory mkdtmp() if not provided
		const tempDir = process.cwd() ?? "/tmp/"
		const testDir = this.options.testDir || tempDir
		// Header
		const warn = this.createAlerter("warn")
		yield warn(`Testing`)
		yield warn(`  Chat ID: ${this.chat.id}`)
		yield warn(`  Chat Dir: ${this.chat.dir}`)
		yield warn(`  Test Dir: ${testDir}`)

		yield this.info()
		// Signal the caller to continue the chat loop.
		yield false
	}
	/**
	 * @param {object} [input]
	 * @param {string[]} [input.argv=[]]
	 * @param {Partial<Chat>} [input.chat]
	 * @returns {TestCommand}
	 */
	static create(input = {}) {
		const {
			argv = [],
			chat = new Chat()
		} = input
		const options = parseArgv(argv, TestOptions)
		return new TestCommand({ options, chat })
	}
}
