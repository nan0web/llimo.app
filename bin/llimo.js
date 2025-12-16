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
import { spawn } from "node:child_process"
import path from "node:path"

const __dirname = path.dirname(new URL(import.meta.url).pathname)

/**
 * Map subcommand to its script
 */
const commands = new Map([
	["chat", "bin/llimo-chat.js"],
	["pack", "bin/llimo-pack.js"],
	["unpack", "bin/llimo-unpack.js"],
	["models", "bin/llimo-models.js"],
	["system", "bin/llimo-system.js"],
	["release", "bin/llimo-release.js"],
	// Add more as needed
])

async function main(argv = process.argv.slice(2)) {
	const subcmd = argv.shift()
	if (!subcmd) {
		console.error("Usage: llimo <command> [args...]")
		console.error("Commands: " + Array.from(commands.keys()).join(", "))
		process.exit(1)
	}

	const scriptPath = commands.get(subcmd)
	if (!scriptPath) {
		console.error(`Unknown command: ${subcmd}`)
		process.exit(1)
	}

	// Delegate to the sub-script with remaining args
	const child = spawn(process.execPath, [path.resolve(__dirname, "..", scriptPath), ...argv], {
		stdio: "inherit"
	})
	child.on("exit", code => process.exit(code ?? 0))
}

main().catch(err => {
	console.error("❌ llimo error:", err.message)
	process.exit(1)
})
