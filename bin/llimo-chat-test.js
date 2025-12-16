#!/usr/bin/env node
import process from "node:process"
import path from "node:path"

import { parseArgv, Ui, BOLD, RESET } from "../src/cli/index.js"
import TestOptions from "../src/Test/Options.js"
import TestRunner from "../src/llm/TestRunner.js"
import { Chat } from "../src/llm/index.js"
import FileSystem from "../src/utils/FileSystem.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

/**
 * Main entry
 * @param {string[]} [argv]
 */
async function main(argv = process.argv.slice(2)) {
	const command = parseArgv(argv, TestOptions)
	const cleanArgv = command.argv

	const modes = ["info", "unpack", "test", "mock"]
	let mode = modes[0]
	if (modes.includes(cleanArgv[0])) {
		mode = cleanArgv.shift()
	}
	const chatDir = cleanArgv.shift()

	if (!chatDir) {
		console.error("Usage: llimo-chat-test [mode] <chat-dir> [--step N] [--dir /path] [--delay ms]")
		console.error("Modes: info (default), unpack, test, mock")
		process.exit(1)
	}

	const options = { ...command, mode }

	// -----------------------------------------------------------------
	// `mock` – interactive simulation of a single user message using the
	// already‑saved chunk files.  It re‑uses TestRunner's `simulateStep`
	// method but does not perform full test/unpack flow.
	// -----------------------------------------------------------------
	if (mode === "mock") {
		// Resolve absolute chat directory
		const fs = new FileSystem()
		const chatPath = fs.path.resolve(chatDir)

		// Build a Chat instance that points exactly to the stored chat directory.
		// We set `cwd` to the parent folder and `root` to '' so that Chat.dir === chatPath.
		const chatParent = path.dirname(chatPath)
		const chatId = fs.path.basename(chatPath)
		const chat = new Chat({ id: chatId, cwd: chatParent, root: "" })

		await chat.init()
		const loaded = await chat.load()
		if (!loaded) {
			console.error(`❌ Cannot load chat from ${chatPath}`)
			process.exit(1)
		}

		// If the user supplied `--step N` we honour it, otherwise ask interactively.
		let step = options.step
		if (!step || step < 1) {
			const answer = await ui.ask("Enter the user message number to mock (or empty to abort): ")
			if (!answer.trim()) {
				console.info("⏩ No step selected – exiting mock mode.")
				process.exit(0)
			}
			step = Number(answer)
			if (!Number.isInteger(step) || step < 1) {
				console.error(`❌ Invalid step number: ${answer}`)
				process.exit(1)
			}
		}
		// Prepare a TestRunner instance (only to reuse its simulation helpers)
		const runner = new TestRunner(ui, chatPath, { ...options, step })
		try {
			const { fullResponse, parsed } = await runner.simulateStep(chat)
			ui.console.info(`${BOLD}--- Mocked response for step ${step} ---${RESET}`)
			ui.console.info(fullResponse)

			// Show the parsed markdown file list (dry‑run) for user inspection
			ui.console.info(`${BOLD}--- Parsed files (dry run) ---${RESET}`)
			for (const file of parsed.correct) {
				ui.console.info(`- ${file.filename} (${file.type}, ${file.encoding})`)
			}
		} catch (err) {
			console.error(`❌ Mock simulation failed: ${err.message}`)
			process.exit(1)
		}
		return
	}

	// -----------------------------------------------------------------
	// Normal modes – delegate to TestRunner as before.
	// -----------------------------------------------------------------
	const runner = new TestRunner(ui, chatDir, options)
	await runner.run()
}

main().catch(err => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})
