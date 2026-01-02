#!/usr/bin/env node
import { ReleaseCommand, ReleaseOptions } from "../src/Chat/commands/release.js"
import { parseArgv } from "../src/cli/argvHelper.js"
import Ui from "../src/cli/Ui.js"
import { DIM, RESET } from "../src/cli/ANSI.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

export async function main(argv = process.argv.slice(2)) {
	const options = parseArgv(argv, ReleaseOptions)
	const cmd = new ReleaseCommand({ options, ui })

	/** @type {Map<string, any[]>} taskId => chunk[] */
	const chunks = new Map()
	// const height = 3
	let printed = 0

	ui.createProgress(() => {
		const [, h] = ui.stdout.getWindowSize()
		if (printed) ui.cursorUp(printed)
		const height = Math.max(1, Math.floor(h / chunks.size))
		const rows = Array.from(chunks.entries()).map(([id, chunks]) => {
			ui.overwriteLine(`${id} => ${chunks.slice(-1)[0] ?? ""}`)
			ui.console.info()
			if (height > 1) {
				// @todo print more lines if height > 1 in DIM
				ui.overwriteLine(`${DIM}line of the chunks${RESET}\n`)
			}
		})
		for (let i = 0; i < printed - rows.length; i++) ui.overwriteLine("\n")
	}, Date.now(), 33)

	/**
	 *
	 * @param {object} param0
	 * @param {import("../src/Chat/commands/release.js").Task} param0.task
	 * @param {any} param0.chunk
	 */
	function onData({ task, chunk }) {
		const arr = chunks.get(task.link) ?? []
		arr.push(chunk)
		chunks.set(task.link, arr)
	}

	const stream = cmd.run({ onData })
	for await (const element of stream) {
		if (true === element) {
			ui.console.success("Complete")
		} else if (false === element) {
			ui.console.error("Failed")
		} else {
			ui.render(element)
		}
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	})
}
