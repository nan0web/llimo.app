import { describe, it } from "node:test"
import assert from "node:assert/strict"
import TestOptions from "./Options.js"

describe("TestOptions", () => {
	it("creates with defaults", () => {
		const options = new TestOptions()
		assert.strictEqual(options.mode, "info")
		assert.strictEqual(options.step, 1)
		assert.strictEqual(options.outputDir, "")
		assert.strictEqual(options.delay, 10)
		assert.deepStrictEqual(options.argv, [])
	})

	it("sets values from input", () => {
		const input = {
			mode: "unpack",
			step: 3,
			outputDir: "/tmp/unpack",
			delay: 50,
			argv: ["chat/dir"]
		}
		const options = new TestOptions(input)
		assert.strictEqual(options.mode, "unpack")
		assert.strictEqual(options.step, 3)
		assert.strictEqual(options.outputDir, "/tmp/unpack")
		assert.strictEqual(options.delay, 50)
		assert.deepStrictEqual(options.argv, ["chat/dir"])
	})

	it("handles invalid types", () => {
		const input = {
			step: "invalid",
			delay: "slow",
			outputDir: 1,
			mode: 2,
		}
		const options = new TestOptions(input)
		assert.ok(Number.isNaN(options.step)) // Number("invalid") = NaN
		assert.ok(Number.isNaN(options.delay))
		assert.equal(options.outputDir, "1")
		assert.equal(options.mode, "2")
	})
})
