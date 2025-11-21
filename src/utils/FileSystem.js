/**
 * Utility functions for llimo-chat
 */
import fs from 'node:fs/promises'
import process from 'node:process'

import Path from './Path.js'

/**
 * @typedef {import('node:fs').Mode | import('node:fs').MakeDirectoryOptions | null} MkDirOptions
 */

/**
 * File system operations wrapper to allow testing
 */
export default class FileSystem {
	/** @type {Path} */
	path
	constructor() {
		this.path = new Path()
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
	 * @returns {Promise<Object>}
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

	async save(path, data, options) {
		const abs = this.path.resolve(process.cwd(), path)
		const dir = this.path.dirname(abs)
		await fs.mkdir(dir, { recursive: true, mode: options?.mode || 0o777 })
		return await fs.writeFile(abs, data, options)
	}
}
