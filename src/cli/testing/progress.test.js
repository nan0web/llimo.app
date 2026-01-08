import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { testingProgress } from "./progress.js"
import { Ui } from "../Ui.js"

describe("testingProgress", () => {
	it("should print some progress", async () => {
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
		// @ts-ignore
		const ui = new Ui({ stdout, console: { console: mockConsole } })
		const output = []
		const testing = testingProgress({ ui, output, rows: 3, prefix: "@nan0web: ", fps: 99 })
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
		await new Promise(resolve => setTimeout(resolve, 3))
		for (const row of predefined) {
			output.push(row)
			await new Promise(resolve => setTimeout(resolve, 9))
		}
		clearInterval(testing)
		const expected = []
		const required = [
			"tests: 0 | pass: 0 | fail: 0 | cancelled: 0 | types: 0 | skip: 0 | todo: 0",
			"tests: 1 | pass: 0 | fail: 0 | cancelled: 0 | types: 0 | skip: 0 | todo: 0",
			"# pass 1",
			"tests: 1 | pass: 1 | fail: 0 | cancelled: 0 | types: 0 | skip: 0 | todo: 0",
		]
		let prev = -1
		for (const r of required) {
			const index = out.findIndex(([, args]) => args.some(a => a.includes(r)))
			if (index > prev) {
				expected.push([index, r])
				prev = index
			}
		}
		assert.deepStrictEqual(expected.length, required.length)
	})
})
