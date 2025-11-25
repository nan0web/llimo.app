import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { generateSystemPrompt } from "./system.js"
import { FileSystem } from "../utils.js"

describe("system module", () => {
	let tempDir

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true })
		}
	})

	it("should generate system prompt string", async () => {
		const prompt = await generateSystemPrompt()
		assert.ok(prompt.includes("<!--TOOLS_LIST-->") === false, "Tools list placeholder should be replaced")
		assert.ok(prompt.includes("validate"), "Should include validate command")
		assert.ok(prompt.includes("bash"), "Should include bash command")
	})

	it("should write system prompt to a file", async () => {
		tempDir = await mkdtemp(resolve(tmpdir(), "llimo-system-test-"))
		const outputPath = resolve(tempDir, "system.md")

		await generateSystemPrompt(outputPath)

		const fs = new FileSystem()
		const exists = await fs.exists(outputPath)
		assert.strictEqual(exists, true, "System prompt file should be created")

		const content = await fs.readFile(outputPath, "utf-8")
		assert.ok(content.includes("validate"), "File content should be valid")
	})
})
