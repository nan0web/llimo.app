#!/usr/bin/env node
/*
 * llimo-pack.js – pack a list of files described in a markdown checklist
 * into a JSONL stream that can later be unpacked with `llimo-unpack.js`.
 *
 * Expected markdown syntax (one item per line, e.g.):
 *   - [](bin/llimo-unpack.js)
 *   - [](bin/llimo-unpack.test.js)
 *
 * The script accepts the markdown source either as a file path argument
 * or via STDIN (piped).  For each recognised item it reads the target file
 * (UTF‑8) and writes a JSON line of the form:
 *   {"filename":"<relative‑path>","content":"<file‑content>","encoding":"utf-8"}
 *
 * No external dependencies – everything is built‑in Node.js.
 */

import { fileURLToPath } from "node:url"
import process from "node:process"

import { FileSystem, Path, GREEN, RESET, ITALIC } from "../src/utils.js"
import commands from "../src/llm/commands/index.js"

/**
 * Main entry point.
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const pathUtil = new Path()

	const template = await fs.readFile("src/llm/commands/template.system.md", "utf-8")

	let outputPath = undefined        // where packed markdown should be written (stdout if undefined)

	// No stdin data – treat argv as potential input file.
	if (argv.length > 0) {
		outputPath = pathUtil.resolve(process.cwd(), argv[0])
	}

	const list = Array.from(commands.keys()).join(", ")
	const md = Array.from(commands.values()).map(
		Command => `### ${Command.name}\n${Command.help}\n\nExample:\n#### [${Command.label}](@${Command.name})\n${Command.example}`
	).join("\n\n")

	const output = template.replaceAll("<!--TOOLS_LIST-->", list).replaceAll("<!--TOOLS_MD-->", md)
	if (outputPath) {
		const format = new Intl.NumberFormat("en-US").format
		await fs.writeFile(outputPath, output)
		const stats = await fs.stat(outputPath)
		console.info(` ${GREEN}+${RESET} File has been saved (${ITALIC}${format(stats.size)} bytes${RESET})`)
		console.info(` ${GREEN}+ ${outputPath}${RESET}`)
	} else {
		console.info(output)
	}
}

main().catch(err => {
	console.error("❌ Fatal error in llimo‑pack:", err)
	process.exit(1)
})
