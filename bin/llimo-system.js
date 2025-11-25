#!/usr/bin/env node
/*
 * llimo-system.js – generate system prompt for LLiMo with available commands
 *
 * Generates a system prompt markdown file that includes:
 * - Base system prompt template
 * - List of available tools/commands
 * - Documentation for each command
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

	// Generate tools list and documentation
	const list = Array.from(commands.keys()).join(", ")
	const md = Array.from(commands.values()).map(
		Command => `### ${Command.name}\n${Command.help}\n\nExample:\n#### [${Command.label || Command.name}](@${Command.name})\n\`\`\`${Command.example.includes('```') ? '' : 'txt'}\n${Command.example}\n\`\`\``
	).join("\n\n")

	// Replace placeholders in template
	const output = template
		.replaceAll("<!--TOOLS_LIST-->", list)
		.replaceAll("<!--TOOLS_MD-->", md)

	// Write output
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
	console.error("❌ Fatal error in llimo‑system:", err)
	process.exit(1)
})
