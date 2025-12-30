#!/usr/bin/env node
import { main } from "../src/llm/pack.js"
import { Ui } from "../src/cli/index.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

main().catch((err) => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})
