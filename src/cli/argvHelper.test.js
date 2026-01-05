import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseArgv } from "./argvHelper.js"

// Mock ChatOptions class for parseArgv tests
class ChatOptions {
	argv = []
	isNew = false
	isYes = false
	testMode = null
	testDir = null

	constructor(obj = {}) {
		Object.assign(this, obj)
	}
}

describe("argvHelper", () => {
	describe("parseArgv", () => {
		const expectations = [
			[["me.md", "--new"], { argv: ["me.md"], isNew: true }],
			[["me.md", "--new", "--yes"], { argv: ["me.md"], isNew: true, isYes: true }],
			[["me.md", "--new", "--yes", "new"], { argv: ["me.md", "new"], isNew: true, isYes: true }],
			[["me.md", "--new", "--some", "new"], { argv: ["me.md", "--some", "new"], isNew: true }],
			[["--test=1.md"], { argv: [], testMode: "1.md" }],
			[["--test", "1.md"], { argv: [], testMode: "1.md" }],
			[["--test-dir=1.md"], { argv: [], testDir: "1.md" }],
			[["--test-dir", "1.md"], { argv: [], testDir: "1.md" }],
			[["--some", "thing"], { argv: ["--some", "thing"] }],
			[["--some=thing"], { argv: ["--some=thing"] }],
			[["--new"], { argv: [], isNew: true }],
			[["--yes"], { argv: [], isYes: true }],
		]

		for (const [argv, obj] of expectations) {
			it(`should parse ${argv.join(" ")}`, () => {
				ChatOptions.isNew = { type: "boolean", default: false, alias: "new" }
				ChatOptions.isYes = { type: "boolean", default: false, alias: "yes" }
				ChatOptions.testMode = { type: "string", default: null, alias: "test" }
				ChatOptions.testDir = { type: "string", default: null, alias: "test-dir" }
				const parsed = parseArgv(argv, ChatOptions)
				assert.deepStrictEqual(parsed, new ChatOptions(obj))
			})
		}

		it("should throw error for missing value", () => {
			assert.throws(() => parseArgv(["--test"], ChatOptions), /Value for the option "testMode" not provided/)
		})
	})
})
