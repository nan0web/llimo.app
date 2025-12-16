import { Alert, Table } from "../../cli/components/index.js"
import { Ui, UiCommand } from "../../cli/Ui.js"
import { parseArgv } from "../../cli/argvHelper.js"
import Chat from "../../llm/Chat.js"
import Markdown from "../../utils/Markdown.js"

/**
 * Options for the `info` command.
 */
export class InfoOptions {
	/** @type {string} */
	id
	static id = {
		help: "Chat ID (optional), if not provided current will be used",
		default: ""
	}
	constructor(input = {}) {
		const {
			id = InfoOptions.id.default,
		} = input
		this.id = String(id)
	}
}

/**
 * `info` command – shows a table with per‑message statistics and a total line.
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
export class InfoCommand extends UiCommand {
	static name = "info"
	static help = "Show information of the chat: messages count, files attached, tokens and bytes size, time and cost"
	options = new InfoOptions()
	chat = new Chat()
	ui = new Ui()
	constructor(input = {}) {
		super()
		const {
			options = this.options,
			chat = this.chat,
			ui = this.ui,
		} = input
		this.options = options
		this.chat = new Chat({ ...chat, id: options.id })
		this.ui = ui
	}
	async * run() {
		await this.chat.init()
		if (!this.chat.id) {
			throw new Error("Provide Chat ID")
		}
		// Header
		yield new Alert(`Chat ID: ${this.chat.id}`)
		yield this.info()

		// Signal the caller to continue the chat loop.
		yield false
	}
	/**
	 * @returns {Promise<Table>}
	 */
	async info() {
		/** @type {Array<Array<any>>} rows for UI.table */
		const rows = [["No", "i", "Role", "Files", "Size", "Tokens"], ["--", "--", "---", "---", "---", "---"]]
		let totalFiles = 0
		let totalBytes = 0
		let totalTokens = 0
		let step = 1

		for (let i = 0; i < this.chat.messages.length; ++i) {
			const msg = this.chat.messages[i]
			const role = msg.role
			const content = String(msg.content)
			const bytes = Buffer.byteLength(content)
			const tokens = await this.chat.calcTokens(content)

			// Count attached files (markdown checklist)
			const parsed = await Markdown.parse(content)
			const files = parsed.files?.size ?? 0

			totalFiles += files
			totalBytes += bytes
			totalTokens += tokens

			rows.push([
				`${i + 1}`,
				step,
				role,
				this.ui.formats.count(files),
				this.ui.formats.weight("b", bytes),
				this.ui.formats.weight("T", tokens),
			])
			if ("assistant" === msg.role) ++step
		}

		// Append total line
		rows.push([
			"", "", "TOTAL",
			this.ui.formats.count(totalFiles),
			this.ui.formats.weight("b", totalBytes),
			this.ui.formats.weight("T", totalTokens),
		])

		return new Table({ rows, options: { divider: " | ", aligns: ["right", "right", "left", "right", "right", "right"] } })
	}
	/**
	 * @param {object} [input]
	 * @param {string[]} [input.argv=[]]
	 * @param {Partial<Chat>} [input.chat]
	 * @returns {InfoCommand}
	 */
	static create(input = {}) {
		const {
			argv = [],
			chat = new Chat()
		} = input
		const options = parseArgv(argv, InfoOptions)
		return new InfoCommand({ options, chat })
	}
}
