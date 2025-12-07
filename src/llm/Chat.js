import { randomUUID } from "node:crypto"
import FileSystem from "../utils/FileSystem.js"

/** @typedef {{ role: string, content: string | { text: string, type: string } }} ChatMessage */

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
	/** @type {import("ai").ModelMessage[]} */
	messages = []
	/** @type {FileSystem} Access to the current working directory file system */
	#fs
	/** @type {FileSystem} access to the chat directory file system */
	#db

	/**
	 * @param {Partial<Chat>} [input={}]
	 */
	constructor(input = {}) {
		const {
			id = randomUUID(), cwd = process.cwd(), root = "chat", messages = []
		} = input
		this.id = String(id)
		this.cwd = String(cwd)
		this.root = String(root)
		this.#fs = new FileSystem({ cwd })
		this.messages = messages
		this.dir = this.#fs.path.resolve(root, id)
		this.#db = new FileSystem({ cwd: this.dir })
	}

	get #path() {
		return this.#fs.path
	}

	/** @returns {FileSystem} */
	get fs() {
		return this.#fs
	}

	/** @returns {FileSystem} */
	get db() {
		return this.#db
	}

	/** @returns {import("ai").ModelMessage[]} */
	get systemMessages() {
		return this.messages.filter(m => m.role === "system")
	}

	/** @returns {import("ai").ModelMessage[]} */
	get userMessages() {
		return this.messages.filter(m => m.role === "user")
	}

	/** @returns {import("ai").ModelMessage[]} */
	get assistantMessages() {
		return this.messages.filter(m => m.role === "assistant")
	}

	/** @returns {import("ai").ModelMessage[]} */
	get toolMessages() {
		return this.messages.filter(m => m.role === "tool")
	}

	/**
	 * Initialize chat directory
	 */
	async init() {
		await this.#fs.mkdir(this.dir, { recursive: true })
	}

	/**
	 * Add a message to the history
	 * @param {import("ai").ModelMessage} message
	 */
	add(message) {
		this.messages.push(message)
	}

	/**
	 * Returns tokens count for all messages.
	 * @returns {number}
	 */
	getTokensCount() {
		return Math.round(this.messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4)
	}

	async clear() {
		await this.db.save("messages.jsonl", [])
	}

	/**
	 * @returns {Promise<boolean>}
	 */
	async load() {
		if (await this.db.exists("messages.jsonl")) {
			const rows = await this.db.load("messages.jsonl") ?? []
			for (const row of rows) {
				if (row instanceof Error) {
					// Ignore bad rows instead of throwing
				} else {
					this.add(row)
				}
			}
			return true
		}
		return false
	}

	async save() {
		await this.db.save("messages.jsonl", this.messages)
	}

	/**
	 * Save the latest prompt
	 * @param {string} prompt
	 * @returns {Promise<string>} The prompt path.
	 */
	async savePrompt(prompt) {
		const promptPath = this.#path.resolve(this.dir, "prompt.md")
		await this.#fs.writeFile(promptPath, prompt)
		return promptPath
	}

	/**
	 * Save the AI response
	 * @param {string} answer
	 * @param {number} [step] - Optional step number for per-step files
	 */
	async saveAnswer(answer, step) {
		const answerPath = this.#path.resolve(this.dir, step ? `answer-step${step}.md` : "answer.md")
		await this.#fs.writeFile(answerPath, answer)
	}
}

