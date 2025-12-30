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

import { Ui } from "../src/cli/index.js"
import { FileSystem, Path, ReadLine } from "../src/utils/index.js"
import Markdown from "../src/utils/Markdown.js"
import { unpackAnswer } from "../src/llm/unpack.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

/**
 * @typedef {Object} JSONResponse
 * @property {string} filename
 * @property {string} content
 * @property {string} [encoding="utf-8"]
 */

function usage() {
	ui.console.info("")
	ui.console.info("Usage with a pipe format:")
	ui.console.info("  ")
	ui.console.info(`  echo '{"filename":"test.md","content":"# Hello"}' | llimo-unpack [output-file]`)
	ui.console.info("  ")
	ui.console.info("Usage with a file format:")
	ui.console.info("  ")
	ui.console.info("  llimo-unpack <input-file> [output-file]")
	ui.console.info("  ")
	ui.console.info("    input-file  - Path to the input file")
	ui.console.info("    output-file - Path to the output file prints to stdout if not defined")
	ui.console.info("  ")
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

	const isDry = argv.includes("--dry")
	argv = argv.filter(a => !a.startsWith("-"))

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
	 * Detect and collect possible stdin data *before* interpreting argv.
	 *    - If stdin is not a TTY we try to read everything.
	 *    - If any data is present, it represents the markdown source.
	 */
	if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) {
			stdinData += chunk
		}
	}

	/**
	 * Decide how to interpret argv based on whether we already have stdin data.
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
	ui.console.info()

	const parsed = await Markdown.parseStream(mdStream)
	const stream = unpackAnswer(parsed, isDry, baseDir)
	for await (const str of stream) {
		ui.console.info(str)
	}
}

main().catch((err) => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})
