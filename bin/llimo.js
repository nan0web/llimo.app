#!/usr/bin/env node
/**
 * llimo – main CLI router for subcommands
 *
 * Usage:
 *   llimo <command> [args...]
 *
 * Commands:
 *   chat     – Interact with LLM
 *   pack     – Pack markdown into files
 *   unpack   – Unpack markdown into filesystem
 *   models   – Browse/select models
 *   system   – Generate system prompt
 *   release  – Run release tasks
 *   <other>  – Delegate to bin/llimo-<command>.js if exists
 */
import process from "node:process"
import { Ui } from "../src/cli/index.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

if (process.argv.length < 3) {
	ui.console.error("Usage: llimo <command> [options]")
	ui.console.info("\nCommands:")
	ui.console.info("  chat     – Interactive chat with AI (default)")
	ui.console.info("  models   – List available models and filter")
	ui.console.info("  pack     – Pack markdown checklist into prompt")
	ui.console.info("  unpack   – Unpack files/commands from markdown response")
	// Add other commands as needed (e.g., release, system)
	process.exit(1)
}

const subcmd = process.argv[2]
const args = process.argv.slice(3)

if (subcmd === "chat") {
	// Delegate to chat main with remaining args
	import("./llimo-chat.js").then(({ main }) => main(args))
} else if (subcmd === "models") {
	import("./llimo-models.js").then(({ main }) => main(args))
} else if (subcmd === "pack") {
	import("./llimo-pack.js").then(({ main }) => main(args))
} else if (subcmd === "release") {
	import("./llimo-release.js").then(({ main }) => main(args))
} else if (subcmd === "unpack") {
	// import("./llimo-unpack.js").then(({ main }) => main(args))
} else {
	ui.console.error(`Unknown command: ${subcmd}`)
	ui.console.info("Available commands: chat, models, pack, unpack")
	process.exit(1)
}
