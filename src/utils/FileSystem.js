/**
 * Utility functions for llimo-chat
 */
import fs, { mkdtemp } from 'node:fs/promises'
import process from 'node:process'
import os from "node:os"
import { Stream } from 'node:stream'
import { Stats } from 'node:fs'
import { sep } from 'node:path'

import micromatch from 'micromatch'

import { Path } from './Path.js'

/**
 * @typedef {import('node:fs').Mode | import('node:fs').MakeDirectoryOptions | null} MkDirOptions
 */

/**
 * File system operations wrapper to allow testing
 */
export class FileSystem {
	/** @type {string} */
	cwd
	/** @type {Path} */
	#path
	/**
	 * @param {Partial<FileSystem>} [input={}]
	 */
	constructor(input = {}) {
		const {
			cwd = process.cwd(),
		} = input
		this.cwd = String(cwd)
		this.#path = new Path({ cwd })
		/** @type {Map<string, (path: string, encoding: BufferEncoding) => Promise<any>>} */
		this.loaders = new Map([
			[".jsonl", this._jsonlLoader.bind(this)],
			[".json", this._jsonLoader.bind(this)],   // JSON loader
		])
		/** @type {Map<string, (path: string, data: any, options: any) => Promise<void>>} */
		this.savers = new Map([
			[".jsonl", this._jsonlSaver.bind(this)],
			[".json", this._jsonSaver.bind(this)],   // JSON saver
		])
	}
	get path() {
		return this.#path
	}
	/**
	 * Check if file exists
	 * @param {string} path
	 * @returns {Promise<boolean>}
	 */
	async access(path) {
		try {
			await fs.access(path)
			return true
		} catch {
			return false
		}
	}
	/**
	 * Read file content
	 * @param {string} path
	 * @param {BufferEncoding} [encoding]
	 * @returns {Promise<string>}
	 */
	async readFile(path, encoding = 'utf-8') {
		return fs.readFile(path, encoding)
	}
	/**
	 * Load a file – behaviour mirrors the original implementation:
	 *   * If the file does **not** exist → `undefined`
	 *   * If an extension is registered in `loaders` → use that loader
	 *   * Otherwise → plain text read (`utf‑8` by default)
	 *
	 * @param {string} path
	 * @param {BufferEncoding} [encoding='utf-8']
	 * @returns {Promise<any|undefined>}
	 */
	async load(path, encoding = 'utf-8') {
		const abs = this.path.resolve(path)
		if (!await this.access(abs)) return undefined

		const ext = this.path.extname(path)
		const fn = this.loaders.get(ext)
		if (fn) {
			return await fn(abs, encoding)
		}
		// fallback – plain text
		return await this.readFile(abs, encoding)
	}
	/**
	 * Write file content
	 * @param {string} path
	 * @param {string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | Stream} content
	 * @param {Object} [options]
	 * @returns {Promise<void>}
	 */
	async writeFile(path, content, options) {
		return fs.writeFile(path, content, options)
	}
	/**
	 * Create directory
	 * @param {string} path
	 * @param {MkDirOptions} [options]
	 * @returns {Promise<string | undefined>}
	 */
	async mkdir(path, options) {
		return fs.mkdir(path, options)
	}
	/**
	 * Get file stats
	 * @param {string} path
	 * @returns {Promise<Stats>}
	 */
	async stat(path) {
		return fs.stat(path)
	}
	/**
	 * Open file handle
	 * @param {string} path
	 * @returns {Promise<Object>}
	 */
	async open(path) {
		return fs.open(path)
	}
	/**
	 * Check if path exists and get stats
	 * @param {string} path
	 * @returns {Promise<boolean>}
	 */
	async exists(path) {
		try {
			const abs = this.path.resolve(path)
			await fs.access(abs)
			return true
		} catch {
			return false
		}
	}
	/**
	 * Read directory contents
	 * @param {string} path
	 * @param {any} [options]
	 * @returns {Promise<string[]>}
	 */
	async readdir(path, options) {
		return fs.readdir(path, options)
	}
	/**
	 * Normalise a path for pattern matching – strip trailing slashes.
	 * @param {string} p
	 * @returns {string}
	 */
	#normalize(p) {
		return p.replace(/\/+$/, '')
	}
	/**
	 * Check if a path matches any ignore pattern
	 * @param {string} relPath The relative path to check (from startPath)
	 * @param {string} fullPath The full absolute path
	 * @param {string[]} patterns Array of ignore patterns (supports glob patterns)
	 * @returns {boolean} True if path should be ignored
	 */
	#shouldIgnore(relPath, fullPath, patterns) {
		const rel = this.#normalize(relPath)
		const abs = this.#normalize(fullPath)
		const words = this.path.split(rel)

		// Direct string match (both with and without trailing slash)
		if (patterns.includes(rel) || patterns.includes(abs)) return true
		if (patterns.includes(relPath) || patterns.includes(fullPath)) return true
		if (words.some(w => patterns.some(p => w === p))) return true

		// Glob pattern check (on normalised paths)
		if (micromatch.isMatch(rel, patterns, { dot: true })) return true
		if (micromatch.isMatch(abs, patterns, { dot: true })) return true

		// For directories, also check each parent segment
		if (relPath.endsWith('/')) {
			const parts = relPath.split('/').filter(Boolean)
			for (let i = 0; i < parts.length; i++) {
				const parent = parts.slice(0, i + 1).join('/') + '/'
				const parentNorm = this.#normalize(parent)
				if (micromatch.isMatch(parentNorm, patterns, { dot: true })) return true
				if (micromatch.isMatch(parent, patterns, { dot: true })) return true
			}
		}

		return false
	}
	/**
	 * Recursively browse a directory.
	 * @param {string} path The starting path.
	 * @param {object} [options={}]
	 * @param {boolean} [options.recursive=false] Whether to browse recursively.
	 * @param {string[]} [options.ignore=[]] An array of directory/file patterns to ignore (supports glob patterns).
	 * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
	 * @param {number} [options.depth=Infinity] Maximum depth to traverse.
	 * @returns {Promise<string[]>} A promise that resolves to an array of file/directory paths.
	 */
	async browse(path, options = {}) {
		const { recursive = false, ignore = [], onRead, depth = Infinity } = options
		const startPath = this.path.resolve(path)
		const rel = this.path.relative(this.cwd, startPath)
		const results = []
		let currentDepth = 0

		/**
		 * @param {string} dir
		 * @param {string} dirPathRelative
		 * @returns {Promise<void>}
		 */
		const _traverse = async (dir, dirPathRelative) => {
			dirPathRelative = dirPathRelative || "."
			currentDepth++
			if (currentDepth > depth) return
			let entries
			try {
				entries = await fs.readdir(dir, { withFileTypes: true })
			} catch (/** @type {any} */ error) {
				console.error(`Error reading directory ${dir}:`, error.message)
				return
			}

			if (typeof onRead === 'function') {
				await onRead(dirPathRelative, entries.map(e => {
					const full = this.path.resolve(e.parentPath, e.name)
					if (this.#shouldIgnore(e.name, full, ignore)) {
						return ""
					}
					return this.path.relative(this.cwd, full)
				}).filter(Boolean))
			}

			for (const entry of entries) {
				const fullPath = this.path.resolve(dir, entry.name)
				let rel = this.path.relative(startPath, fullPath)
				if (entry.isDirectory()) rel += '/'

				if (!this.#shouldIgnore(rel, fullPath, ignore)) {
					results.push(rel)
				}

				if (entry.isDirectory() && recursive) {
					const dirRel = this.path.relative(startPath, fullPath)
					if (!this.#shouldIgnore(dirRel + '/', fullPath, ignore)) {
						await _traverse(fullPath, dirRel)
					}
				}
			}
		}

		await _traverse(startPath, rel)
		return results
	}
	/**
	 * Relative proxy of stat().
	 * @param {string} path
	 * @returns {Promise<Stats>}
	 */
	async info(path) {
		const abs = this.path.resolve(path)
		return await this.stat(abs)
	}
	/**
	 * JSON loader for .jsonl files.
	 * @param {string} path
	 * @param {BufferEncoding} [encoding="utf-8"]
	 * @returns {Promise<any[]>}
	 */
	async _jsonlLoader(path, encoding = "utf-8") {
		const jsonl = await this.readFile(path, encoding)
		const rows = jsonl.split("\n").map(s => s.trim()).filter(Boolean)
		const result = []
		for (const row of rows) {
			try {
				const data = JSON.parse(row)
				result.push(data)
			} catch (/** @type {any} */ err) {
				result.push(err)
			}
		}
		return result
	}
	/**
	 * JSON loader for standard .json files.
	 * @param {string} path
	 * @param {BufferEncoding} [encoding="utf-8"]
	 * @returns {Promise<any>}
	 */
	async _jsonLoader(path, encoding = "utf-8") {
		const raw = await this.readFile(path, encoding)
		return JSON.parse(raw)
	}
	/**
	 * @param {string} path
	 * @param {any} rows
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async _jsonlSaver(path, rows = [], options = {}) {
		let str = ""
		const { flag } = options
		if ("a" === flag) {
			// append to the end of file
			str = JSON.stringify(rows)
			await fs.appendFile(path, str, options)
		} else {
			if (!Array.isArray(rows)) {
				throw new Error("JSONL accept only rows (array of any type of data)")
			}
			for (const row of rows) str += JSON.stringify(row) + "\n"
			await fs.writeFile(path, str, options)
		}
	}
	/**
	 * JSON saver – writes a plain JSON file.
	 * @param {string} path
	 * @param {any} data
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async _jsonSaver(path, data = {}, options = {}) {
		const { flag } = options
		if ("a" === flag) {
			if ("string" !== data) {
				throw new Error("Cannot append JSON file with object data, only string is allowed for append or use save instead of append.")
			}
			await fs.appendFile(path, data, options)
			return
		}
		const payload = "string" === typeof data ? data : JSON.stringify(data, null, 2)
		await fs.writeFile(path, payload, options)
	}
	/**
	 * Relative proxy of mkdir() & writeFile().
	 * @param {string} path
	 * @param {any} [data]
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async save(path, data, options) {
		const abs = this.path.resolve(path)
		const dir = this.path.dirname(abs)
		await fs.mkdir(dir, { recursive: true, mode: options?.mode || 0o777 })
		// save by extension
		const ext = this.path.extname(path)
		const fn = this.savers.get(ext)
		if (fn) {
			return await fn(abs, data, options)
		}
		return await fs.writeFile(abs, data ?? "", options)
	}
	/**
	 * Relative proxy of mkdir() & writeFile(path, data, { flag: "a" }).
	 * @param {string} path
	 * @param {any} data
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async append(path, data, options = {}) {
		return await this.save(path, data, { ...options, flag: "a" })
	}
	/**
	 * @param {string} prefix
	 * @returns {Promise<string>}
	 */
	async mkdtemp(prefix) {
		const path = prefix.includes(sep) ? this.path.resolve(prefix) : this.path.resolve(os.tmpdir(), prefix)
		return await mkdtemp(path)
	}
}
