import { FileSystem } from "../../utils/FileSystem.js"
import { DIM, GREEN, RED, RESET, YELLOW } from "../ANSI.js"
import { Ui } from "../Ui.js"
import { Suite } from "./node.js"

/** @typedef {(input: import("../Ui.js").ProgressFnInput, printed?: number, frame?: string) => void} AfterProgressFn */

function noDebugger(str) {
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
 * @deprecated use ChatCliApp.testingProgress instead
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
	return runningProgress({
		ui, output, rows, prefix, startTime, fps, after: (input) => {
			const suite = new Suite({ rows: output, fs })
			const parsed = suite.parse()
			const str = testingStatus(parsed, ui.formats.timer(input.elapsed * 1e3))
			ui.overwriteLine(`  ${str}`)
		}
	})
}

/**
 * Creates progress for commands to run in a window.
 * @deprecated use ChatCliApp.runningProgress instead
 * @param {object} param0
 * @param {Ui} param0.ui
 * @param {string[]} [param0.output]
 * @param {number} [param0.rows=0] The window height
 * @param {string} [param0.prefix=""]
 * @param {number} [param0.startTime]
 * @param {number} [param0.fps=33]
 * @param {AfterProgressFn} [param0.after]
 * @returns {NodeJS.Timeout}
 */
export function runningProgress({ ui, output = [], rows = 0, prefix = "", startTime = Date.now(), fps = 33, after = () => { } }) {
	let printed = 0
	return ui.createProgress((input) => {
		if (printed) ui.cursorUp(printed)
		let arr = output.filter(Boolean).filter(noDebugger)
		if (rows > 0) arr = arr.slice(-rows)
		ui.console.startFrame()
		const lines = arr.map(r => ui.console.clear(prefix + r))
		lines.forEach(l => ui.console.info(`\r${DIM}${l}${RESET}`))
		if (lines.length < printed) {
			for (let i = 0; i < printed - lines.length; i++) {
				ui.console.info(ui.console.clear(""))
			}
		}
		printed = lines.length

		after(input, printed, ui.console.stopFrame())
	}, startTime, fps)
}
