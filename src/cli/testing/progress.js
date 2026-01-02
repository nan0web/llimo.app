import FileSystem from "../../utils/FileSystem.js"
import { DIM, GREEN, RED, RESET, YELLOW } from "../ANSI.js"
import Ui from "../Ui.js"
import { Suite } from "./node.js"

export function noDebugger(str) {
	return ![
		"Error: Waiting for the debugger to disconnect",
		"Error: Debugger attached",
	].some(s => str.includes(s))
}

/**
 * @param {import("./node.js").TapParseResult} parsed
 * @returns
 */
export function testingStatus(parsed, elapsed = "") {
	return elapsed + " " + [
		["tests"], ["pass", GREEN], ["fail", RED], ["cancelled", RED], ["types", RED],
		["skip", YELLOW], ["todo", YELLOW]
	].map(([f, color = RESET]) => `${color}${f}: ${parsed.counts.get(f)}${RESET}`).join(" | ")
}

/**
 * Creates progress for testing commands.
 * @param {object} param0
 * @param {Ui} param0.ui
 * @param {FileSystem} [param0.fs]
 * @param {string[]} [param0.output]
 * @param {number} [param0.rows=0]
 * @param {string} [param0.prefix=""]
 * @param {number} [param0.startTime]
 * @param {number} [param0.fps=33]
 * @returns {NodeJS.Timeout}
 */
export function testingProgress({ ui, fs = new FileSystem(), output = [], rows = 0, prefix = "", startTime = Date.now(), fps = 33 }) {
	let printed = 0
	return ui.createProgress((input) => {
		const suite = new Suite({ rows: output, fs })
		const parsed = suite.parse()

		if (rows > 0) {
			if (printed) ui.cursorUp(printed)
			const lines = output.filter(Boolean).filter(noDebugger).slice(-rows).map(r => ui.console.full(prefix + r))
			lines.forEach(l => ui.console.info(`\r${DIM}${l}${RESET}`))
			if (lines.length < printed) {
				for (let i = 0; i < printed - lines.length; i++) {
					ui.console.info(ui.console.full(""))
				}
			}
			printed = lines.length
		}

		const str = testingStatus(parsed, ui.formats.timer(input.elapsed))
		ui.overwriteLine(`  ${str}`)
	}, startTime, fps)
}
