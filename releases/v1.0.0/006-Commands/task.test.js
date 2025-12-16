import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("006-Commands – src/llm/commands/*", () => {
	describe("6.1 Command registry (index.js)", () => {
		it("exports commands map", async () => {
			const cmdsPath = resolve(rootDir, "src/llm/commands/index.js")
			const commands = await import(`file://${cmdsPath}`)
			assert.ok(commands.default.size >= 5, "validate, ls, get, bash, rm, summary")
		})
	})
})
