import { describe, it } from "node:test"
import assert from "node:assert"
import { parseArgv } from "./argvHelper.js"
import ChatOptions from "../Chat/Options.js"

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
	]
	for (const [argv, obj] of expectations) {
		it(`should parse ${argv.join(" ")}`, () => {
			const parsed = parseArgv(argv, ChatOptions)
			assert.deepStrictEqual(parsed, new ChatOptions(obj))
		})
	}
})
