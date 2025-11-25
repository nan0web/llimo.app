import { randomUUID } from "node:crypto"
import FileSystem from "./FileSystem.js"

/**
 * Manages chat history and files
 */
export default class Chat {
	/** @type {string} */
	id
	/** @type {string} */
	cwd
	/** @type {string} */
	root
	/** @type {string} */
	dir
	/** @type {FileSystem} */
	#fs

	/**
	 * @param {Partial<Chat>} [input={}]
	 */
	constructor(input = {}) {
		const { id = randomUUID(), cwd = process.cwd(), root = "chat" } = input
		this.id = String(id)
		this.cwd = String(cwd)
		this.root = String(root)
		this.#fs = new FileSystem({ cwd })
		this.dir = this.#fs.path.resolve(root, id)
	}

	get #path() {
		return this.#fs.path
	}

	/**
	 * Initialize chat directory
	 */
	async init() {
		await this.#fs.mkdir(this.dir, { recursive: true })
	}

	/**
	 * Get path to messages file
	 * @returns {string}
	 */
	getMessagesPath() {
		return this.#path.resolve(this.dir, "messages.jsonl")
	}

	/**
	 * Add a message to the history
	 * @param {Object} message
	 * @param {string} message.role
	 * @param {string} message.content
	 * @param {Object} [message.usage]
	 * @param {number} [message.usage.inputTokens]
	 * @param {number} [message.usage.outputTokens]
	 * @param {number} [message.usage.cacheTokens]
	 * @param {number} [message.usage.totalCost]
	 */
	async addMessage(message) {
		const messagesPath = this.getMessagesPath()
		const line = JSON.stringify(message) + "\n"
		await this.#fs.writeFile(messagesPath, line, { flag: "a" })
	}

	/**
	 * Get all messages
	 * @returns {Promise<Object[]>}
	 */
	async getMessages() {
		const messagesPath = this.getMessagesPath()
		if (!(await this.#fs.exists(messagesPath))) {
			return []
		}
		const content = await this.#fs.readFile(messagesPath, "utf-8")
		return content.split("\n").filter(Boolean).map(line => JSON.parse(line))
	}

	/**
	 * Save the latest prompt
	 * @param {string} prompt
	 */
	async savePrompt(prompt) {
		const promptPath = this.#path.resolve(this.dir, "prompt.md")
		await this.#fs.writeFile(promptPath, prompt)
	}

	/**
	 * Save the AI response
	 * @param {string} answer
	 */
	async saveAnswer(answer) {
		const answerPath = this.#path.resolve(this.dir, "answer.md")
		await this.#fs.writeFile(answerPath, answer)
	}
}
