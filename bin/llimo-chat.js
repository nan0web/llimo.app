#!/usr/bin/env node
/**
 * CLI entry point for LLiMo
 * @see https://github.com/nan0web/llimo
 */

import process from "node:process"
import { Git, FileSystem } from "../src/utils/index.js"
import { RESET, parseArgv, Ui, ChatCLiApp } from "../src/cli/index.js"
import { ChatOptions } from "../src/Chat/index.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

/**
 * Main chat loop
 * @param {string[]} [argv]
 */
export async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const git = new Git({ dry: true })
	ui.console.info(RESET)

	// Parse arguments
	const command = parseArgv(argv, ChatOptions)

	if (command.isHelp) {
		ui.console.info(`LLiMo CLI - Language Living Models Chat

Usage: llimo chat [options]

Options:
	--help     Show this help
	--debug    Enable debug output
	--new      Start new chat instead of loading existing
	--yes      Auto-answer yes to all prompts
	--model=ID Select specific model (e.g. gpt-oss-120b)
	--provider=NAME  Select provider (e.g. openrouter)
	--one      One-line progress (--tiny)
	--fast     Use fast selection instead of interactive

Examples:
	llimo chat me.md                    # default model, interactive
	llimo chat --model qwen-3-32b me.md  # specific model
	llimo models --filter id~gpt         # list models
	llimo pack checklist.md > prompt.md  # pack files
	llimo unpack response.md             # unpack files/commands
`)
		process.exit(0)
	}

	const app = new ChatCLiApp({ fs, git, ui, options: command })
	// 1. initialise / load chat
	const shouldContinue = await app.init(argv)
	if (!shouldContinue) {
		ui.console.success("+ Command complete")
		return false
	}
	const input = await app.readInput()
	if (!input) {
		ui.console.error(`Cannot read input from stdin or file ${app.inputFile}`)
		return false
	}
	// 2. run the loop from task to solution [input → response → test → repeat until 100% pass]
	await app.loop()
}

/* -------------------------------------------------------------------------- */

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	})
}

