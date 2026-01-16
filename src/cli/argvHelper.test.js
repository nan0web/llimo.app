import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseArgv } from "./argvHelper.js"

// Mock ChatOptions class for parseArgv tests
class ChatOptions {
	static argv = { default: [] }
	argv = ChatOptions.argv.default.slice()
	static isNew = { default: false, alias: "new" }
	isNew = ChatOptions.isNew.default
	static isYes = { default: false, alias: "yes" }
	isYes = ChatOptions.isYes.default
	static testMode = { default: "", alias: "test" }
	testMode = ChatOptions.testMode.default
	static testDir = { default: "__tests__", alias: "test-dir" }
	testDir = ChatOptions.testDir.default

	constructor(obj = {}) {
		Object.assign(this, obj)
	}
}

describe("argvHelper", () => {
	describe("parseArgv", () => {
		/** @type {Array<[string[] | Record<string, any>, object, Record<string, any> | undefined]>} */
		const expectations = [
			[["--yes"], { argv: ["a"], isNew: true, isYes: true }, { argv: ["a"], isNew: true, isYes: false }],
			[["me.md", "--new"], { argv: ["me.md"], isNew: true }, {}],
			[["me.md", "--new", "--yes"], { argv: ["me.md"], isNew: true, isYes: true }, undefined],
			[["me.md", "--new", "--yes", "new"], { argv: ["me.md", "new"], isNew: true, isYes: true }, undefined],
			[["me.md", "--new", "--some", "new"], { argv: ["me.md", "--some", "new"], isNew: true }, undefined],
			[["--test=1.md"], { argv: [], testMode: "1.md" }, undefined],
			[["--test", "1.md"], { argv: [], testMode: "1.md" }, undefined],
			[["--test-dir=1.md"], { argv: [], testDir: "1.md" }, undefined],
			[["--test-dir", "1.md"], { argv: [], testDir: "1.md" }, undefined],
			[["--some", "thing"], { argv: ["--some", "thing"] }, undefined],
			[["--some=thing"], { argv: ["--some=thing"] }, undefined],
			[["--new"], { argv: [], isNew: true }, undefined],
			[["--yes"], { argv: [], isYes: true }, undefined],
			[{ yes: true }, { argv: [], isYes: true }, undefined],
			[{ argv: ["me.md", "--some", "new"], new: true }, { argv: ["me.md", "--some", "new"], isNew: true }, undefined],
			[{ argv: ["me.md", "--some", "new"], new: true }, { argv: ["me.md", "--some", "new"], isNew: true, isYes: true }, { yes: true }],
		]

		for (const [argv, obj, def] of expectations) {
			it(`should parse ${JSON.stringify(argv)}`, () => {
				const parsed = parseArgv(argv, ChatOptions, def)
				assert.deepStrictEqual(parsed, new ChatOptions(obj))
			})
		}

		it("should throw error for missing value", () => {
			assert.throws(() => parseArgv(["--test"], ChatOptions), /Value for the option "testMode" not provided/)
		})

		it("should not affect changes on defaults", () => {
			class Model {
				static argv = {
					default: []
				}
				argv = Model.argv.default
				static inputFile = {
					stack: "argv",
					default: "me.md"
				}
				inputFile = Model.inputFile.default
				constructor(input = {}) {
					Object.assign(this, input)
				}
			}
			const def = {
				inputFile: "def.md",
			}
			const opts = { inputFile: "document.md" }
			let parsed = parseArgv(opts, Model, def)
			assert.equal(def.inputFile, "def.md")
			assert.deepStrictEqual(def.argv, undefined)
			assert.equal(parsed.inputFile, "document.md")
			assert.deepStrictEqual(parsed.argv, [])

			parsed = parseArgv(["argument.md"], Model, def)
			assert.equal(def.inputFile, "def.md")
			assert.deepStrictEqual(def.argv, undefined)
			assert.equal(parsed.inputFile, "argument.md")
			assert.deepStrictEqual(parsed.argv, [])
		})

		it("should process 2 steps defaults: default, system, agent, user", () => {
			class Options {
				static ignore = {
					default: [".git", "node_modules"],
				}
				ignore = Options.ignore.default
				constructor(input = {}) {
					Object.assign(this, input)
				}
			}
			const systemVars = {
				ignore: [".git", "node_modules", "chat/*/**"]
			}
			const options = {
				ignore: [".venv"]
			}
			const sysOpts = parseArgv(systemVars ?? {}, Options, options)
			const result = parseArgv([], Options, sysOpts)
			assert.deepStrictEqual(result.ignore, systemVars.ignore)
		})
	})
})

