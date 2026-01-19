import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { generateSystemPrompt, parseSystemPrompt, mergeSystemPrompts } from "./system.js"
import { FileSystem } from "../utils/index.js"
import ChatOptions from "../Chat/Options.js"

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

	it("should parse system prompt without variables", () => {
		const prompt = [
			"---",
			"# Some system instructions",
			"With no vars",
		].join("\n")
		const result = parseSystemPrompt(prompt)
		assert.deepStrictEqual(result, {
			vars: {},
			content: prompt,
		})
	})

	it("should parse system prompt with variables", () => {
		const prompt = [
			"---",
			"inputFile: dev.md",
			"arr: [1, 2, 3]",
			"---",
			"# Some system instructions",
			"With vars",
		].join("\n")
		const result = parseSystemPrompt(prompt)
		assert.deepStrictEqual(result, {
			vars: {
				inputFile: "dev.md",
				arr: [1, 2, 3],
			},
			content: "# Some system instructions\nWith vars",
		})
	})

	it("should merge prompts", () => {
		const p1 = [
			"---",
			"inputFile: dev.md",
			"test:",
			"  command: vitest",
			"---",
			"# Instructions 1",
			"Details 1",
		].join("\n")
		const p2 = [
			"---",
			"test:",
			"  command: node",
			"  args:",
			"    - --test",
			"    - --test-timeout=333",
			"---",
			"# Instructions 2",
			"Details 2",
		].join("\n")
		const p3 = [
			"---",
			"inputFile: what.md",
			"---",
			"# Instructions 3",
			"Details 3",
		].join("\n")
		const system = mergeSystemPrompts([p1, p2, p3])
		assert.deepStrictEqual(system, {
			head: "---\ninputFile: what.md\ntest:\n  command: node\n  args:\n    - --test\n    - --test-timeout=333\n---\n",
			body: [
				"# Instructions 1\nDetails 1",
				"# Instructions 2\nDetails 2",
				"# Instructions 3\nDetails 3",
			].join("\n\n---\n\n"),
			vars: new ChatOptions({
				inputFile: "what.md",
				test: { command: "node", args: ["--test", "--test-timeout=333"] }
			})
		})
	})
})
