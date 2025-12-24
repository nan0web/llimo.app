#!/usr/bin/env node

/**
 * CLI entry point for LLiMo
 * @see https://github.com/nan0web/llimo
 */

import process from "node:process"
import { Git, FileSystem } from "../src/utils/index.js"
import { RESET, parseArgv, Ui, ChatCLiApp } from "../src/cli/index.js"
import { ChatOptions } from "../src/Chat/index.js"

/**
 * Main chat loop
 * @param {string[]} [argv]
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const git = new Git({ dry: true })
	const ui = new Ui({ debugMode: argv.includes("--debug") })
	ui.console.info(RESET)

	// Parse arguments
	const command = parseArgv(argv, ChatOptions)

	if (command.isHelp) {
		ui.console.info(`LLiMo CLI - Language Living Models Chat

Usage: llimo <command> [options]

Commands:
	chat      Interactive chat with AI (default)
	models    List available models with filter
	pack      Pack markdown checklist into prompt
	unpack    Unpack files/commands from markdown response

Global options:
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

main().catch((err) => {
	console.error("❌ Fatal error in llimo‑chat:", err.message)
	if (err.stack && process.argv.includes("--debug")) console.error(err.stack)
	process.exit(1)
})

