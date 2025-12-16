#!/usr/bin/env node
import process from "node:process"
import { Git, FileSystem } from "../src/utils/index.js"
import { RESET, parseArgv, Ui, ChatCLiApp } from "../src/cli/index.js"
import { ChatOptions } from "../src/Chat/index.js"

// const DEFAULT_MODEL = "gpt-oss-120b"
// const DEFAULT_MODEL = "zai-glm-4.6"
// const DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"
// const DEFAULT_MODEL = "qwen-3-32b"
// const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
// const DEFAULT_MODEL = "x-ai/grok-4-fast"
const DEFAULT_MODEL = "gpt-oss-120b"

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

	const app = new ChatCLiApp({ fs, git, ui, options: command })
	// 1. initialise / load chat
	await app.init(argv)
	const input = await app.readInput()
	if (!input) {
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

