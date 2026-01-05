import { FileSystem } from "../../utils/FileSystem.js"

/**
 * Mock FileSystem for testing purposes.
 * Stores all data in memory without accessing the real filesystem.
 */
export class TestFileSystem extends FileSystem {
	/** @type {Map<string, any>} */
	#data
	/** @type {string[]} */
	#logs

	/**
	 * @param {Partial<FileSystem> & { data?: [string, any][] | Map<string, any> }} input
	 */
	constructor(input = {}) {
		const {
			data = [],
			...rest
		} = input
		super(rest)
		this.#logs = []
		this.#data = new Map()

		const temp = data instanceof Map ? data : new Map(data)
		temp.forEach((value, path) => {
			this.#data.set(this.path.normalize(path), value)
		})
	}

	/**
	 * Get all stored data.
	 * @returns {Map<string, any>}
	 */
	getData() {
		return new Map(this.#data)
	}

	/**
	 * Get operation logs.
	 * @returns {string[]}
	 */
	getLogs() {
		return [...this.#logs]
	}

	/**
	 * Clear all data and logs.
	 */
	clear() {
		this.#data.clear()
		this.#logs = []
	}

	/**
	 * @param {string} path
	 * @returns {Promise<boolean>}
	 */
	async access(path) {
		const rel = this.path.normalize(path)
		this.#logs.push(`access:${rel}`)
		return this.#data.has(rel)
	}

	/**
	 * @param {string} path
	 * @param {BufferEncoding} [encoding]
	 * @returns {Promise<any>}
	 */
	async load(path, encoding) {
		const rel = this.path.normalize(path)
		this.#logs.push(`load:${rel}`)
		return this.#data.get(rel) ?? null
	}

	/**
	 * @param {string} path
	 * @param {any} data
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async save(path, data, options) {
		const rel = this.path.normalize(path)
		this.#logs.push(`save:${rel}`)
		this.#data.set(rel, data)
	}

	/**
	 * @param {string} path
	 * @returns {Promise<void>}
	 */
	async append(path, data, options) {
		const rel = this.path.normalize(path)
		this.#logs.push(`append:${rel}`)
		const existing = this.#data.get(rel) ?? ""
		this.#data.set(rel, existing + data)
	}

	/**
	 * @param {string} path
	 * @returns {Promise<import("node:fs").Stats>}
	 */
	async info(path) {
		const rel = this.path.normalize(path)
		this.#logs.push(`info:${rel}`)
		const exists = this.#data.has(rel)
		const content = this.#data.get(rel)
		const size = exists ? JSON.stringify(content).length : 0
		const now = Date.now()
		return {
			isFile: () => exists,
			isDirectory: () => false,
			size,
			ctimeMs: now,
			atimeMs: now,
			mtimeMs: now,
		}
	}

	/**
	 * @param {string} path
	 * @param {object} [options]
	 * @returns {Promise<string[]>}
	 */
	async browse(path, options = {}) {
		const rel = this.path.normalize(path)
		this.#logs.push(`browse:${rel}`)
		const { recursive = false, depth = Infinity } = options
		const prefix = rel.endsWith("/") ? rel : rel + "/"
		const results = []

		for (const [key] of this.#data.entries()) {
			if (key.startsWith(prefix)) {
				const relative = key.slice(prefix.length)
				const parts = relative.split("/")
				if (recursive) {
					if (depth === Infinity || parts.length <= depth) {
						results.push(key)
					}
				} else if (parts.length === 1) {
					results.push(key)
				}
			}
		}
		return results
	}

	/**
	 * @param {string} path
	 * @returns {Promise<boolean>}
	 */
	async exists(path) {
		const rel = this.path.normalize(path)
		this.#logs.push(`exists:${rel}`)
		return this.#data.has(rel)
	}
}
