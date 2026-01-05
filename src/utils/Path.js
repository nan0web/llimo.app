import process from 'node:process'
import { dirname, extname, resolve, basename, relative, sep } from 'node:path'

/**
 * Path operations wrapper
 */
export class Path {
	/** @type {string} */
	cwd
	/**
	 * @param {Partial<Path>} [input={}]
	 */
	constructor(input = {}) {
		{
			const {
				cwd = process.cwd(),
			} = input
			this.cwd = String(cwd)
		}
	}

	/**  @returns {string} */
	get sep() {
		return sep
	}

	/**
	 * Get directory name
	 * @param {string} path
	 * @returns {string}
	 */
	dirname(path) {
		return dirname(path)
	}

	/**
	 * Get file extension
	 * @param {string} path
	 * @returns {string}
	 */
	extname(path) {
		return extname(path)
	}

	/**
	 * Resolve path
	 * @param {...string} paths
	 * @returns {string}
	 */
	resolve(...paths) {
		return resolve(this.cwd, ...paths)
	}

	/**
	 * Solve the relative path from {from} to {to} based on the current working directory.
	 * At times we have two absolute paths, and we need to derive the relative path from one to the other. This is actually the reverse transform of path.resolve.
	 *
	 * @param {string} from
	 * @param {string} to
	 * @returns {string}
	 * @throws {TypeError} if either `from` or `to` is not a string.
	 */
	relative(from, to) {
		return relative(from, to)
	}

	/**
	 * Get basename
	 * @param {string} path
	 * @returns {string}
	 */
	basename(path) {
		return basename(path)
	}

	/**
	 * Returns normalized (relative to cwd) path.
	 * @param {string} path
	 * @returns {string}
	 */
	normalize(path) {
		const abs = this.resolve(this.cwd, path)
		return this.relative(this.cwd, path)
	}

	/**
	 * Splits the string by directory separator {this.sep}.
	 * @param {string} str
	 * @returns {string[]}
	 */
	split(str) {
		return String(str).split(this.sep)
	}
}

