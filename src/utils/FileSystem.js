/**
 * Utility functions for llimo-chat
 */
import fs from 'node:fs/promises'
import process from 'node:process'

import Path from './Path.js'
import { Stream } from 'node:stream'
import { Stats } from 'node:fs'
import { minimatch } from 'minimatch'

/**
 * @typedef {import('node:fs').Mode | import('node:fs').MakeDirectoryOptions | null} MkDirOptions
 */

/**
 * File system operations wrapper to allow testing
 */
export default class FileSystem {
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
			await fs.access(path)
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
	 * Check if a path matches any ignore pattern
	 * @param {string} path The path to check (relative to startPath)
	 * @param {string} dir The path of the parent directory to check (relative to startPath)
	 * @param {string[]} patterns Array of ignore patterns (supports glob patterns)
	 * @returns {boolean} True if path should be ignored
	 */
	#shouldIgnore(path, dir, patterns) {
		if (patterns.includes(path)) return true
		const full = this.path.resolve(dir, path)
		if (patterns.includes(full)) return true
		return patterns.some(p => {
			return minimatch(full, p, { dot: true })
		})
	}

	/**
	 * Recursively browse a directory.
	 * @param {string} path The starting path.
	 * @param {object} [options={}]
	 * @param {boolean} [options.recursive=false] Whether to browse recursively.
	 * @param {string[]} [options.ignore=[]] An array of directory/file patterns to ignore (supports glob patterns).
	 * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
	 * @returns {Promise<string[]>} A promise that resolves to an array of file/directory paths.
	 */
	async browse(path, options = {}) {
		const { recursive = false, ignore = [], onRead } = options
		const startPath = this.path.resolve(path)
		const results = []

		/**
		 * @param {string} dir
		 * @param {string} dirPathRelative
		 * @returns {Promise<void>}
		 */
		const _traverse = async (dir, dirPathRelative = '.') => {
			let entries
			try {
				entries = await fs.readdir(dir, { withFileTypes: true })
			} catch (/** @type {any} */ error) {
				console.error(`Error reading directory ${dir}:`, error.message)
				return
			}

			const entryPaths = entries.map(entry => this.path.resolve(dir, entry.name))
			const relativeEntries = entryPaths.map(
				p => this.path.relative(startPath, p)
			).filter(p => !this.#shouldIgnore(p, dir, ignore))

			if (typeof onRead === 'function') {
				await onRead(dirPathRelative, relativeEntries)
			}

			for (const entry of entries) {
				const fullPath = this.path.resolve(dir, entry.name)
				let rel = this.path.relative(startPath, fullPath)
				if (entry.isDirectory()) rel += "/"

				if (!this.#shouldIgnore(rel, dir, ignore)) {
					results.push(rel)
				}

				if (entry.isDirectory() && recursive) {
					const dirRel = this.path.relative(startPath, fullPath)
					if (!this.#shouldIgnore(dirRel, dir, ignore)) {
						await _traverse(fullPath, dirRel)
					}
				}
			}
		}

		await _traverse(startPath)
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
	 * Relative proxy of readFile().
	 * @param {string} path
	 * @param {BufferEncoding} [encoding]
	 * @returns {Promise<string>}
	 */
	async load(path, encoding) {
		const abs = this.path.resolve(path)
		return await this.readFile(abs, encoding)
	}

	/**
	 * Relative proxy of mkdir() & writeFile().
	 * @param {string} path
	 * @param {any} data
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async save(path, data, options) {
		const abs = this.path.resolve(path)
		const dir = this.path.dirname(abs)
		await fs.mkdir(dir, { recursive: true, mode: options?.mode || 0o777 })
		return await fs.writeFile(abs, data, options)
	}
}

