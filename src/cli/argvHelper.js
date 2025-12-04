import process from "node:process"
import { Readable } from "node:stream"
import ReadLine from "../utils/ReadLine.js"
import FileSystem from "../utils/FileSystem.js"
import Path from "../utils/Path.js"

/**
 * Shared logic for parsing command‑line arguments and optional STDIN data.
 *
 * Both `llimo-pack.js` and `llimo-unpack.js` need identical behaviour:
 *  - If STDIN is not a TTY, treat the incoming data as the markdown source.
 *  - If STDIN is empty, interpret `argv[0]` as an input markdown file and
 *    optionally `argv[1]` as an output destination.
 *  - When only an output destination is supplied (no input file), fall back to
 *    an interactive readline (the same as the original scripts).
 *
 * The function returns an object containing:
 *   - `mdStream`: a readline Interface that yields markdown lines, or `null`
 *   - `outputPath`: absolute path where the result should be written (or `undefined`)
 *   - `baseDir`: directory used to resolve relative file paths (defaults to cwd)
 *
 * @param {string[]} argv   Command‑line arguments (already sliced).
 * @param {string} stdinData Raw data read from stdin (empty string if none).
 * @returns {Promise<{mdStream: import('readline').Interface|null, outputPath?: string, baseDir: string}>}
 */
export async function parseIO(argv, stdinData) {
	const fs = new FileSystem()
	const pathUtil = new Path()
	const rl = new ReadLine()

	let mdStream = null
	let baseDir = process.cwd()
	let outputPath = undefined

	/** check whether a path points to an existing file */
	async function argIsFile(arg) {
		try {
			await fs.access(pathUtil.resolve(process.cwd(), arg))
			return true
		} catch {
			return false
		}
	}

	if (stdinData) {
		// stdin supplies the markdown; any argument is the output path.
		mdStream = rl.createInterface({
			input: Readable.from([stdinData]),
			crlfDelay: Infinity,
		})
		if (argv.length > 0) outputPath = pathUtil.resolve(process.cwd(), argv[0])
	} else if (argv.length > 0) {
		if (await argIsFile(argv[0])) {
			const mdFile = pathUtil.resolve(process.cwd(), argv[0])
			mdStream = rl.createInterface({
				input: (await fs.open(mdFile)).createReadStream(),
				crlfDelay: Infinity,
			})
			baseDir = pathUtil.dirname(mdFile)
			if (argv.length > 1) outputPath = pathUtil.resolve(process.cwd(), argv[1])
		} else {
			outputPath = pathUtil.resolve(process.cwd(), argv[0])
			mdStream = rl.createInterface({ input: process.stdin, crlfDelay: Infinity })
		}
	}
	return { mdStream, outputPath, baseDir }
}

/**
 * Cast a value to a specific primitive type.
 *
 * @param {any} value
 * @param {string} to
 * @returns {any}
 */
function cast(value, to) {
	if ("string" === to) return String(value)
	if ("number" === to) return Number(value)
	return value
}

/**
 * Simple argument parser – returns an **instance** of the provided Model.
 *
 * @template T extends object
 * @param {string[]} argv - Raw arguments (process.argv.slice(2))
 * @param {new (...args:any)=>T} Model - Class whose static properties describe options.
 * @returns {T}
 */
export function parseArgv(argv, Model) {
	// build lookup: long name → prop, alias → prop
	const nameMap = {}
	for (const [prop, cfg] of Object.entries(Model)) {
		nameMap[prop] = prop
		if (cfg.alias) nameMap[cfg.alias] = prop
	}

	/** @type {T} */
	const result = new Model()

	let i = 0
	while (i < argv.length) {
		const raw = argv[i]
		const next = String(argv[i + 1] ?? "")
		let optName = ""

		if (raw.startsWith("-")) {
			const stripped = raw.slice(raw.startsWith("--") ? 2 : 1)
			const candidate = stripped.includes("=") ? stripped.split("=")[0] : stripped
			if (candidate in nameMap) optName = nameMap[candidate]
		}

		if (optName) {
			const defaultVal = Model[optName]?.default
			const type = Model[optName]?.type ?? typeof defaultVal
			let value

			if (raw.includes("=")) {
				const [, ...parts] = raw.split("=")
				value = parts.join("=")
			} else if ("boolean" === type) {
				value = true
			} else if (next) {
				++i
				value = cast(next, type)
			} else {
				throw new Error(`Value for the option "${optName}" not provided`)
			}
			result[optName] = value
		} else {
			// Positional argument – push into result.argv if it exists.
			// Using a runtime guard; @ts-ignore silences TS complaining about missing property.
			// @ts-ignore
			if (result.argv && Array.isArray(result.argv)) {
				// @ts-ignore
				result.argv.push(raw)
			}
		}
		++i
	}
	return result
}
