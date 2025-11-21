#!/usr/bin/env node
/*
 * llimo-unpack.js – unpack JSONL file into files and their content, possible to run
 * commands in terminal.
 *
 * Expected JSONL format { filename: string, content: string, encoding?: string }
 *
 * No external dependencies – everything is built‑in Node.js.
 */

import process from "node:process"
import { Readable } from "node:stream"

import { GREEN, RED, RESET, ITALIC } from "../src/utils/ANSI.js"
import { FileSystem, Path, ReadLine } from "../src/utils.js"
import JSONL from "../src/utils/JSONL.js"

/**
 * @typedef {Object} JSONResponse
 * @property {string} filename
 * @property {string} content
 * @property {string} [encoding="utf-8"]
 */

function usage() {
	console.info("")
	console.info("Usage with a pipe format:")
	console.info("  ")
	console.info(`  echo '{"filename":"test.md","content":"# Hello"}' | llimo-unpack [output-file]`)
	console.info("  ")
	console.info("Usage with a file format:")
	console.info("  ")
	console.info("  llimo-unpack <input-file> [output-file]")
	console.info("  ")
	console.info("    input-file  - Path to the input file")
	console.info("    output-file - Path to the output file prints to stdout if not defined")
	console.info("  ")
}

/**
 * Main entry point.
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const path = new Path()
	const rl = new ReadLine()

	let mdStream = null               // interface that yields markdown lines
	let baseDir = process.cwd()       // directory used to resolve relative file paths
	let stdinData = ''                // raw data read from stdin (if any)

	/**
	 * Helper – determines whether a given argument is an existing file.
	 */
	async function argIsFile(arg) {
		try {
			await fs.access(path.resolve(process.cwd(), arg))
			return true
		} catch {
			return false
		}
	}

	/**
	 * 1️⃣ Detect and collect possible stdin data *before* interpreting argv.
	 *    - If stdin is not a TTY we try to read everything.
	 *    - If any data is present, it represents the markdown source.
	 */
	if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) {
			stdinData += chunk
		}
	}

	/**
	 * 2️⃣ Decide how to interpret argv based on whether we already have stdin data.
	 *    - When stdinData is non‑empty, argv[0] (if present) is treated as the
	 *      *output* file path; the markdown source comes from stdinData.
	 *    - When stdinData is empty, argv[0] is treated as the *input* markdown file.
	 */
	if (stdinData) {
		// stdin provided – markdown comes from stdinData.
		// Build a Readable stream from the collected data for readline processing.
		mdStream = rl.createInterface({ input: Readable.from([stdinData]), crlfDelay: Infinity })
		// If an argument is supplied it designates the output destination.
		if (argv.length > 0) {
			outputPath = path.resolve(process.cwd(), argv[0])
		}
	} else {
		// No stdin data – treat argv as potential input file.
		if (argv.length > 0) {
			const firstIsFile = await argIsFile(argv[0])
			if (firstIsFile) {
				// First argument is a markdown file.
				const mdFile = path.resolve(process.cwd(), argv[0])
				mdStream = rl.createInterface({
					input: (await fs.open(mdFile)).createReadStream(),
					crlfDelay: Infinity,
				})
				baseDir = path.dirname(mdFile)
				// If a second argument exists, treat it as the destination file.
				if (argv.length > 1) {
					outputPath = path.resolve(process.cwd(), argv[1])
				}
			} else {
				// First argument is NOT a file – treat it as the destination path.
				// Markdown will be read from STDIN (which we already know is empty),
				// so we fall back to interactive readline.
				outputPath = path.resolve(process.cwd(), argv[0])
				mdStream = rl.createInterface({ input: process.stdin, crlfDelay: Infinity })
			}
		}
	}
	if (!mdStream) {
		usage()
		return
	}

	const { correct, failed } = await JSONL.parseStream(mdStream)

	const format = new Intl.NumberFormat("en-US").format

	console.info(RESET)
	console.info("Extracting files")

	for (const line of correct) {
		const { filename = "", content = "", encoding = "utf-8" } = line
		const text = String(content).replace(/\\n/g, "\n")
		if (filename.startsWith(":")) {
			const command = filename.slice(1)
			// @todo execute command if it is available
		} else {
			const absPath = path.resolve(baseDir, filename)
			const dir = path.dirname(absPath)
			await fs.mkdir(dir, { recursive: true })
			await fs.writeFile(absPath, text, encoding)
			const size = Buffer.byteLength(text)
			console.info(` ${GREEN}+${RESET} ${filename} (${ITALIC}${format(size)} bytes${RESET})`)
		}
	}

	for (const err of failed) {
		console.error(` ${RED}! Error: ${err.message}${RESET}`)
	}
}

main().catch(err => {
	console.error("❌ Fatal error in llimo‑pack:", err)
	process.exit(1)
})
