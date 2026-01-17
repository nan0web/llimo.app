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

async function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help")) {
		ui.console.error("Usage: llimo <command> [options]")
		ui.console.info("\nCommands:")
		ui.console.info("  chat     – Interactive chat with AI (default)")
		ui.console.info("  list     – List chats and select current")
		ui.console.info("  models   – List available models and filter")
		ui.console.info("  pack     – Pack markdown checklist into prompt")
		ui.console.info("  unpack   – Unpack files/commands from markdown response")
		// Add other commands as needed (e.g., release, system)
		process.exit(1)
	}

	const subcmd = argv[0]
	const args = argv.slice(1)

	if (["list", "ls"].includes(subcmd)) {
		import("./llimo-list.js").then(({ main }) => main(args))
	} else if (subcmd === "models") {
		import("./llimo-models.js").then(({ main }) => main(args))
	} else if (subcmd === "pack") {
		import("./llimo-pack.js").then(({ main }) => main(args))
	} else if (subcmd === "release") {
		import("./llimo-release.js").then(({ main }) => main(args))
	} else if (subcmd === "unpack") {
		import("./llimo-unpack.js").then(({ main }) => main(args))
	} else if (subcmd === "system") {
		import("./llimo-system.js").then(({ main }) => main(args))
	} else {
		// Delegate to chat main with remaining args
		const args = argv.slice("chat" === subcmd ? 1 : 0)
		import("./llimo-chat.js").then(({ main }) => main(args))
	}
}

main().catch(err => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})

