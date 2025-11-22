import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseArgv, Schema } from "./cli.js"

describe("parseArgv – basic parsing", () => {
	it("splits positional arguments correctly", () => {
		const argv = ["node", "script.js", "foo", "bar"]
		const { args, opts } = parseArgv(argv)
		assert.deepEqual(args, ["node", "script.js", "foo", "bar"])
		assert.deepEqual(opts, {})
	})

	it("recognises long flag without value", () => {
		const { args, opts } = parseArgv(["--verbose"])
		assert.deepEqual(args, [])
		assert.deepEqual(opts, { verbose: true })
	})

	it("parses long option with =value", () => {
		const { args, opts } = parseArgv(["--output=dist/index.js"])
		assert.deepEqual(opts, { output: "dist/index.js" })
		assert.deepStrictEqual(args, [])
	})

	it("parses long option with separate value token", () => {
		const { args, opts } = parseArgv(["--mode", "production"])
		assert.deepEqual(opts, { mode: "production" })
		assert.deepStrictEqual(args, [])
	})

	it("parses short flags", () => {
		const { args, opts } = parseArgv(["-abc"])
		assert.deepEqual(opts, { a: true, b: true, c: true })
		assert.deepStrictEqual(args, [])
	})
})

describe("parseArgv – Schema integration", () => {
	it("instantiates Schema with parsed options", () => {
		const { opts } = parseArgv(["--help"], Schema)
		assert.ok(opts instanceof Schema, "Returned object should be a Schema instance")
		assert.strictEqual(opts.help, true)
	})

	it("applies Schema defaults when option omitted", () => {
		const { opts } = parseArgv([], Schema)
		assert.strictEqual(opts.help, false)
	})
})
