import process from "node:process"

import { RESET, Ui, parseArgv } from "../../../src/cli/index.js"
import { testingProgress } from "../../../src/cli/testing/progress.js"
import FileSystem from "../../../src/utils/FileSystem.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })
const fs = new FileSystem()

class ProgressOptions {
	fps
	static fps = {
		alias: "f",
		help: "Frame per seconds (10 by default)",
		default: 10,
	}
	pause
	static pause = {
		alias: "p",
		help: "Pause between every row output in milliseconds (99 by default)",
		default: 99
	}
	rows
	static rows = {
		alias: "r",
		help: "Rows in the progress window (3 by default)",
		default: 3
	}
	constructor(input = {}) {
		const {
			pause = ProgressOptions.pause.default,
			rows = ProgressOptions.rows.default,
		} = input
		this.pause = Number(pause)
		this.rows = Number(rows)
	}
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArgv(argv, ProgressOptions)
	const { pause, rows, fps } = options
	const examples = [
		["node.txt", String(await fs.load("src/cli/testing/node.txt") ?? "").split("\n")],
		["node.failure.txt", String(await fs.load("src/cli/testing/node.failure.txt") ?? "").split("\n")],
	]
	ui.console.info(RESET)
	for (const [file, lines] of examples) {
		ui.console.info(`Progress example from ${file}:\n`)
		const output = []
		const testing = testingProgress({ ui, output, rows, prefix: "  @nan0web: ", fps })
		await new Promise(resolve => setTimeout(resolve, 3 * pause))
		for (const row of lines) {
			output.push(row)
			await new Promise(resolve => setTimeout(resolve, pause))
		}
		clearInterval(testing)
		ui.console.info("\n")
	}
}

main().catch((err) => {
	ui.console.error(err.message)
	if (err.stack) ui.console.debug(err.stack)
	process.exit(1)
})
