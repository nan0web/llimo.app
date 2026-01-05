import { before, describe, it } from "node:test"
import assert from "node:assert/strict"

import { testingProgress } from "./progress.js"
import Ui from "../Ui.js"

describe("testingProgress", () => {
	/**
	 * @todo fix 1s delay after the Ui update with Math.round for ms.
	 */
	it.todo("should print some progress", async () => {
		const out = []
		const stdout = {
			getWindowSize: () => [66, 33],
			write: (...args) => { out.push(["write", args]) },
		}
		const mockConsole = {
			debug: (...args) => out.push(["debug", args]),
			info: (...args) => out.push(["info", args]),
			warn: (...args) => out.push(["warn", args]),
			error: (...args) => out.push(["error", args]),
			log: (...args) => out.push(["log", args]),
		}
		const ui = new Ui({ stdout, console: { console: mockConsole } })
		const output = []
		const testing = testingProgress({ ui, output, rows: 3, prefix: "@nan0web: ", fps: 10 })
		const predefined = [
			"TAP version 13",
			"# Subtest: parseOutput",
			"    # Subtest: should produce OK",
			"    ok 1 - should produce OK",
			"      ---",
			"      duration_ms: 0.099833",
			"      type: 'test'",
			"      ...",
			"1..1",
			"# tests 1",
			"# suites 0",
			"# pass 1",
			"# fail 0",
			"# cancelled 0",
			"# skipped 0",
			"# todo 0",
		]
		await new Promise(resolve => setTimeout(resolve, 33))
		for (const row of predefined) {
			output.push(row)
			await new Promise(resolve => setTimeout(resolve, 99))
		}
		clearInterval(testing)
		const expected = []
		let tests = 0, pass = 0, seconds = 0
		for (let i = 1; i <= predefined.length; i++) {
			const win = predefined.slice(i - Math.min(3, i), Math.max(1, i))
			for (const row of win) {
				expected.push(`\r@nan0web: ${row}${" ".repeat(66 - 10 - row.length)}`)
			}
			expected.push(`\r\x1B[K  0:0${seconds} tests: ${tests} | pass: ${pass} | fail: 0 | cancelled: 0 | types: 0 | skip: 0 | todo: 0`)
			if (i < predefined.length) expected.push(`\x1B[${win.length}A`)
			if (11 === i) ++pass
			if (9 === i) {
				++tests
				++seconds
			}
		}
		assert.deepStrictEqual(out.map(([, a]) => a.join(" ")), expected)
	})
})
