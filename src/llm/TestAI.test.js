import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import TestAI from "./TestAI.js"

describe("TestAI – file-based chat simulation", () => {
	let chatDir

	before(async () => {
		chatDir = await mkdtemp(resolve(tmpdir(), "llimo-testai-"))
		// Create test data files
		await writeFile(resolve(chatDir, "chunks.json"), JSON.stringify([
			{ type: "text-delta", text: "Hello" },
			{ type: "reasoning-delta", text: "Thinking..." },
			{ type: "text-delta", text: " world!" }
		]))
		await writeFile(resolve(chatDir, "answer.md"), "Hello world!")
		await writeFile(resolve(chatDir, "reason.md"), "Thinking...")
		await writeFile(resolve(chatDir, "messages.jsonl"), JSON.stringify([
			{ role: "user", content: "Test prompt" }
		]))
		await writeFile(resolve(chatDir, "response.json"), JSON.stringify({
			usage: { inputTokens: 4, reasoningTokens: 2, outputTokens: 2, totalTokens: 8 }
		}))
	})

	after(async () => {
		if (chatDir) await rm(chatDir, { recursive: true, force: true })
	})

	it("should load and simulate response from files", async () => {
		const ai = new TestAI()
		const messages = [{ role: "user", content: "Test" }]
		const result = await ai.streamText("test-model", messages, { cwd: chatDir })
		const { fullResponse, reasoning, usage, chunks } = result

		assert.equal(fullResponse, "Hello world!")
		assert.equal(reasoning, "Thinking...")
		assert.deepEqual(usage, { inputTokens: 4, reasoningTokens: 2, outputTokens: 2, totalTokens: 8 })
		assert.deepEqual(chunks, [
			{ type: "text-delta", text: "Hello" },
			{ type: "reasoning-delta", text: "Thinking..." },
			{ type: "text-delta", text: " world!" }
		])

		// Check streaming
		const streamParts = []
		for await (const part of result.stream) streamParts.push(part)
		assert.ok(streamParts.length > 0, "Should yield stream parts")
		assert.equal(streamParts.find(p => p.type === "usage").usage.totalTokens, 8)
	})

	it("should fall back gracefully if files are missing", async () => {
		const emptyDir = await mkdtemp(resolve(tmpdir(), "llimo-empty-"))
		try {
			const ai = new TestAI()
			const messages = [{ role: "user", content: "Test" }]
			const result = await ai.streamText("test-model", messages, { cwd: emptyDir })
			const { fullResponse, reasoning, usage } = result

			assert.equal(fullResponse, "")
			assert.equal(reasoning, "")
			assert.ok(usage.totalTokens >= 0) // Estimated usage
		} finally {
			await rm(emptyDir, { recursive: true, force: true })
		}
	})
})
