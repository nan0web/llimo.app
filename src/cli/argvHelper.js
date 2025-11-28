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

	/** Helper – check if a path points to an existing file */
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
		if (argv.length > 0) {
			outputPath = pathUtil.resolve(process.cwd(), argv[0])
		}
	} else {
		// No stdin – interpret argv.
		if (argv.length > 0) {
			if (await argIsFile(argv[0])) {
				// First arg is an input markdown file.
				const mdFile = pathUtil.resolve(process.cwd(), argv[0])
				mdStream = rl.createInterface({
					input: (await fs.open(mdFile)).createReadStream(),
					crlfDelay: Infinity,
				})
				baseDir = pathUtil.dirname(mdFile)
				if (argv.length > 1) {
					outputPath = pathUtil.resolve(process.cwd(), argv[1])
				}
			} else {
				// First arg is an output destination; read interactively.
				outputPath = pathUtil.resolve(process.cwd(), argv[0])
				mdStream = rl.createInterface({ input: process.stdin, crlfDelay: Infinity })
			}
		}
	}
	return { mdStream, outputPath, baseDir }
}
