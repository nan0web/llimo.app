#!/usr/bin/env node
/*
 * llimo-system.js – generate system prompt for LLiMo with available commands
 *
 * Generates a system prompt markdown file that includes:
 * - Base system prompt template
 * - List of available tools/commands
 * - Documentation for each command
 */

import process from "node:process"
import { generateSystemPrompt } from "../src/llm/system.js"
import { GREEN, RESET, ITALIC } from "../utils/ANSI.js"
import { FileSystem } from "../src/utils.js"

/**
 * Main entry point.
 */
async function main(argv = process.argv.slice(2)) {
	let outputPath = undefined
	const fs = new FileSystem()
	if (argv.length > 0) {
		outputPath = fs.path.resolve(process.cwd(), argv[0])
	}

	try {
		const output = await generateSystemPrompt(outputPath)

		if (outputPath) {
			const stats = await fs.stat(outputPath)
			const format = new Intl.NumberFormat("en-US").format
			console.info(` ${GREEN}+${RESET} File has been saved (${ITALIC}${format(stats.size)} bytes${RESET})`)
			console.info(` ${GREEN}+ ${outputPath}${RESET}`)
		} else {
			console.info(output)
		}
	} catch (error) {
		console.error(`❌ Cannot generate system prompt: ${error.message}`)
		process.exit(1)
	}
}

main().catch(err => {
	console.error("❌ Fatal error in llimo‑system:", err)
	process.exit(1)
})
