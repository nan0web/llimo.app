import { randomUUID } from "node:crypto"
import { Stats } from "node:fs"
import ModelInfo from "./ModelInfo.js"
import LanguageModelUsage from "./LanguageModelUsage.js"
import FileSystem from "../utils/FileSystem.js"
import Usage from "./Usage.js"

/** @typedef {{ role: string, content: string | { text: string, type: string } }} ChatMessage */

export class ChatConfig {
	model = ""
	provider = ""
	constructor(input = {}) {
		const {
			model = this.model,
			provider = this.provider,
		} = input
		this.model = String(model)
		this.provider = String(provider)
	}
}

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
	/** @type {import("ai").ModelMessage[]} */
	messages = []
	/** @type {Array<{ model: ModelInfo, usage: Usage }>} */
	steps = []
	/** @type {ChatConfig} */
	config
	/** @type {string} */
	dir
	/** @type {FileSystem} Access to the current working directory file system */
	#fs
	/** @type {FileSystem} access to the chat directory file system */
	#db

	/**
	 * @param {Partial<Chat>} [input={}]
	 */
	constructor(input = {}) {
		const {
			id = randomUUID(), cwd = process.cwd(), root = "chat", messages = [],
			steps = [],
			dir = "",
			config = new ChatConfig({}),
		} = input
		this.id = String(id)
		this.cwd = String(cwd)
		this.root = String(root)
		this.messages = messages
		this.steps = steps
		this.config = config
		this.#fs = new FileSystem({ cwd })
		this.dir = dir ? dir : this.#fs.path.resolve(root, id)
		// Fixed: Respect 'dir' input if provided, else construct as before
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

	/** @returns {Record<string, string | null>} Allowed files and directories */
	get allowed() {
		return {
			input: "input.md",
			prompt: "prompt.md",
			model: "model.json",
			files: "files.jsonl",
			inputs: "inputs.jsonl",
			response: "response.json",
			parts: "stream.jsonl",
			stream: "stream.md",
			chunks: "chunks.jsonl",
			unknowns: "unknowns.jsonl",
			answer: "answer.md",
			reason: "reason.md",
			usage: "usage.json",
			fail: "fail.json",
			messages: null,
		}
	}

	/**
	 * Initialize chat directory, load ID from the file storage if undefined.
	 */
	async init() {
		await this.fs.mkdir(this.dir, { recursive: true })
		const data = await this.fs.load(this.root + "/llimo.json") ?? {}
		this.config = new ChatConfig(data)

		if (!this.id) {
			this.id = await this.fs.load(this.root + "/current")
		}
	}

	/**
	 * Returns the total cost of the chat.
	 * @returns {Promise<number>}
	 */
	async cost() {
		let total = 0
		for (const { model, usage } of this.steps) {
			total += model.pricing.calc(usage)
		}
		return total
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
	 * @param {string} [target]
	 * @param {number} [step]
	 * @returns {Promise<any | boolean>}
	 */
	async load(target, step) {
		if (target) {
			// load specific chat file in the step or root directory
			if (target.startsWith("/")) target = target.slice(1)
			const file = this.allowed[target]
			if (step) target = "steps/" + String(step).padStart(3, "0") + "/" + file
			if (await this.db.exists(target)) {
				return await this.db.load(target)
			}
			return undefined
		}
		else {
			// load whole chat
			if (await this.db.exists("messages.jsonl")) {
				const rows = await this.db.load("messages.jsonl") ?? []
				for (const row of rows) {
					if (row instanceof Error) {
						// Ignore bad rows instead of throwing
					} else {
						this.add(row)
					}
				}
				const answers = this.assistantMessages
				this.steps = []
				for (let i = 0; i < answers.length; i++) {
					const step = i + 1
					const model = new ModelInfo(await this.load("model", step) ?? {})
					const usage = new Usage(await this.load("usage", step) ?? {})
					this.steps.push({ model, usage })
				}
				return true
			}
		}
		return false
	}

	/**
	 * @typedef {Object} ComplexTarget
	 * @property {string} input
	 * @property {string} prompt
	 * @property {ModelInfo} model
	 * @property {number} step
	 * @property {string[]} files
	 * @property {string[]} inputs
	 * @property {object} response
	 * @property {string[]} parts
	 * @property {object[]} chunks
	 * @property {Array<[string, any]>} unknowns
	 * @property {string} answer
	 * @property {string} reason
	 * @property {LanguageModelUsage} usage
	 * @property {import("ai").ModelMessage[]} messages
	 *
	 * Saves the whole chat if target is not provided.
	 * If provided saves the specific target and step.
	 * @param {string | Partial<ComplexTarget>} [target]
	 * @param {any} [data]
	 * @param {number} [step]
	 * @returns {Promise<void>}
	 */
	async save(target, data, step) {
		if ("string" === typeof target) {
			// load specific chat file in the step or root directory
			if (target.startsWith("/")) target = target.slice(1)
			const file = this.allowed[target]
			if (null === file) this.save()
			if ("string" === typeof file) target = file
			if (step) target = "steps/" + String(step).padStart(3, "0") + "/" + target
			await this.db.save(target, data)
		} else if ("object" === typeof target) {
			for (const [key, val] of Object.entries(target)) {
				const file = this.allowed[key]
				if (null === file) this.save()
				if ("string" === typeof file) await this.save(file, val, target.step)
			}
		} else {
			await this.db.save("messages.jsonl", this.messages)
		}
	}

	/**
	 * @param {string} path
	 * @returns {Promise<Stats>}
	 */
	async stat(path) {
		return await this.fs.stat(path)
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
	 * Append to a file
	 * @param {string} path
	 * @param {string} data
	 * @param {number} [step]
	 */
	async append(path, data, step) {
		if (path.startsWith("/")) path = path.slice(1)
		const file = this.allowed[path]
		if ("string" === typeof file) path = file
		if (step) path = "steps/" + String(step).padStart(3, "0") + "/" + path
		await this.db.append(path, data)
	}

	/**
	 * @param {string} path
	 * @param {number} [step]
	 * @returns {string}
	 */
	path(path, step) {
		let rel = true
		if (path.startsWith("/")) {
			path = path.slice(1)
			rel = false
		}
		const file = this.allowed[path] ?? path
		if ("string" === typeof file) path = file
		if (step) path = "steps/" + String(step).padStart(3, "0") + "/" + path
		path = this.#path.resolve(this.dir, path)
		if (rel) path = this.fs.path.relative(this.fs.path.resolve("."), path)
		return path
	}

	/**
	 * Calculates the amount of tokens in the text.
	 * @todo make it work with real tokenizers
	 * @param {string} text The text to measure.
	 * @returns {Promise<number>}
	 */
	async calcTokens(text) {
		return Math.ceil(String(text).length / 3.6)
	}
}


