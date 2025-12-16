import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("009-SystemPrompt – system.js", () => {
	describe("9.1 Generates prompt with tools", async () => {
		it("includes commands list", async () => {
			const systemPath = resolve(rootDir, "src/llm/system.js")
			const { generateSystemPrompt } = await import(`file://${systemPath}`)
			const prompt = await generateSystemPrompt()
			assert.ok(prompt.includes("@validate"), "Tools replaced")
		})
	})
})
