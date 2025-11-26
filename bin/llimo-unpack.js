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

import { GREEN, RED, RESET, ITALIC, YELLOW, BOLD, MAGENTA } from "../src/utils/ANSI.js"
import { FileSystem, Path, ReadLine } from "../src/utils.js"
import Markdown from "../src/utils/Markdown.js"
import commands from "../src/llm/commands/index.js"

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

	const parsed = await Markdown.parseStream(mdStream)
	const {
		correct, failed, files
	} = parsed

	const format = new Intl.NumberFormat("en-US").format

	console.info(RESET)
	console.info(`Extracting files ${isDry ? `${YELLOW}(dry mode, no real saving)` : ''}`)

	for (const file of correct) {
		const { filename = "", label = "", content = "", encoding = "utf-8" } = file
		const text = String(content)
		if (filename.startsWith("@")) {
			const command = filename.slice(1)
			const Command = commands.get(command)
			if (Command) {
				const cmd = new Command({ cwd: process.cwd(), file, parsed })
				for await (const str of cmd.run()) {
					console.info(str)
				}
			} else {
				console.error(` ${RED}! Unknown command: ${filename}${RESET}`)
				console.error(' ! Available commands:')
				Array.from(commands.entries()).forEach(([name, Command]) => {
					console.error(` - ${name} - ${Command.help}`)
				})
			}
		} else {
			const absPath = path.resolve(baseDir, filename)
			if ("" === text.trim()) {
				console.info(` ${YELLOW}- ${filename} - ${BOLD}empty content${RESET} - to remove file use command @rm`)
				continue
			}
			if (!isDry) {
				await fs.save(absPath, text, encoding)
			}
			const suffix = label && !filename.includes(label) || label !== files.get(filename)
				? `— ${MAGENTA}${label}${RESET}` : ""
			const size = Buffer.byteLength(text)
			const SAVE = `${GREEN}+`
			const SKIP = `${YELLOW}•`
			console.info(` ${isDry ? SKIP : SAVE}${RESET} ${filename} (${ITALIC}${format(size)} bytes${RESET}) ${suffix}`)
		}
	}

	const empties = failed.filter(err => err.content.trim() === "").map(err => err.line)
	if (empties.length) {
		console.warn(` ${YELLOW}• Empty rows #${empties.join(", #")}`)
	}
	const others = failed.filter(err => err.content.trim() !== "")
	for (const err of others) {
		console.error(` ${RED}! Error: ${err.error}\n > ${err.line}. ${err.content}${RESET}`)
	}
}

main().catch(err => {
	console.error("❌ Fatal error in llimo‑pack:", err)
	process.exit(1)
})
