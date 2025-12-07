#!/usr/bin/env node
import process from "node:process"

import { parseArgv } from "../src/cli/argvHelper.js"
import TestOptions from "../src/Test/Options.js"
import TestRunner from "../src/llm/TestRunner.js"
import Ui from "../src/cli/Ui.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

/**
 * Main entry
 * @param {string[]} [argv]
 */
async function main(argv = process.argv.slice(2)) {
	const command = parseArgv(argv, TestOptions)
	const cleanArgv = command.argv

	const modes = ["info", "unpack", "test"]
	let mode = modes[0]
	if (modes.includes(cleanArgv[0])) {
		mode = cleanArgv.shift()
	}
	const chatDir = cleanArgv.shift()

	if (!chatDir) {
		console.error("Usage: llimo-chat-test [mode] <chat-dir> [--step N] [--dir /path] [--delay ms]")
		console.error("Modes: info (default), unpack, test")
		process.exit(1)
	}

	const options = { ...command, mode }

	const runner = new TestRunner(ui, chatDir, options)
	await runner.run()
}

main().catch(err => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})
