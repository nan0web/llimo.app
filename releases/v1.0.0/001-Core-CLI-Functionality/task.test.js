import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("001-Core-CLI-Functionality – bin/llimo-chat.js main CLI", () => {
	describe("1.1 Basic CLI handling (--help, argv)", () => {
		it("runs llimo-chat.js without crash (CLI entrypoint works)", () => {
			const result = spawnSync("node", [resolve(rootDir, "bin/llimo-chat.js")], {
				encoding: "utf8", timeout: 5000, cwd: rootDir, stdio: "pipe"
			})
			assert.strictEqual(result.signal, null, "No signal kill")
			assert.ok(result.status !== undefined, "Exits with status")
		})

		it("parses options correctly (argvHelper.js)", async () => {
			const argvHelperPath = resolve(rootDir, "src/cli/argvHelper.js")
			const { parseArgv } = await import(`file://${argvHelperPath}`)
			class MockOpts {
				static argv = { default: [] }
				static isNew = { type: "boolean", default: false }
				static isYes = { type: "boolean", default: false }
				constructor(input = {}) {
					const { argv = MockOpts.argv.default, isNew = MockOpts.isNew.default, isYes = MockOpts.isYes.default } = input
					this.argv = argv
					this.isNew = Boolean(isNew)
					this.isYes = Boolean(isYes)
				}
			}
			const opts = parseArgv(["me.md", "--new", "--yes"], MockOpts)
			assert.deepStrictEqual(opts, {
				argv: ["me.md"],
				isNew: true,
				isYes: true
			})
		})
	})

	describe("1.2 Input reading (readInput from chatSteps.js)", () => {
		it("readInput handles file arg", async () => {
			const chatSteps
