import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { TestAI } from "./TestAI.js"
import { formatChatProgress } from "./chatProgress.js"
import { Usage } from "./Usage.js"
import { ModelInfo } from "./ModelInfo.js"
import { Pricing } from "./Pricing.js"
import { Ui } from "../cli/Ui.js"

describe.skip("TestAI – file-based chat simulation", () => {
	let chatDir
	const ui = new Ui()

	before(async () => {
		chatDir = await mkdtemp(resolve(tmpdir(), "llimo-testai-"))
		// Create test data files (covering all specified files) - use correct path format
		const stepDir = "step/001/"
		await writeFile(resolve(chatDir, stepDir + "chunks.jsonl"), JSON.stringify([
			{ type: "text-delta", text: "Hello" },
			{ type: "reasoning-delta", text: "Thinking..." },
			{ type: "text-delta", text: " world!" }
		]))
		await writeFile(resolve(chatDir, stepDir + "stream.json"), JSON.stringify([
			{ type: "text-delta", text: "Extra from stream" }
		]))
		await writeFile(resolve(chatDir, stepDir + "answer.md"), "Hello world!")
		await writeFile(resolve(chatDir, "messages.jsonl"), JSON.stringify([
			{ "role": "system", "content": "You are AI." },
			{ "role": "user", "content": "Test prompt" },
			{ "role": "assistant", "content": "Hi there!" },
			{ "role": "user", "content": "How are you?" },
			{ "role": "assistant", "content": "Good, thanks." }
		]))
		await writeFile(resolve(chatDir, stepDir + "response.json"), JSON.stringify({
			usage: { inputTokens: 4, reasoningTokens: 2, outputTokens: 2, totalTokens: 8 }
		}))
		await writeFile(resolve(chatDir, stepDir + "stream.md"), "\nAppended stream content")
		await writeFile(resolve(chatDir, stepDir + "tests.txt"), "Expected test output: pass")
		await writeFile(resolve(chatDir, stepDir + "todo.md"), "- Fix bug\n- Add feature")
		await writeFile(resolve(chatDir, stepDir + "unknown.json"), JSON.stringify({ debug: "ignored data" }))
		// me.md and prompt.md are ignored, so no need to create them for previous tests
		// Now add extended test data to cover NaN and cost calculation issues
	})

	after(async () => {
		if (chatDir) await rm(chatDir, { recursive: true, force: true })
	})

	it("handles NaN speed and zero cost in progress formatting", async () => {
		const usage = new Usage({ inputTokens: 65879, reasoningTokens: 152, outputTokens: 1176, totalTokens: 67207 })
		const now = Date.now()
		const clock = {
			startTime: now - 4100,  // 4.1s ago
			reasonTime: now - 4100 + 7400,  // Adjust to simulate valid timing
			answerTime: now,  // Current time
		}
		const model = new ModelInfo({
			pricing: new Pricing({ prompt: 0.0035, completion: 0, input_cache_read: 0 }),  // Simulate non-zero pricing for real models
		})

		const lines = formatChatProgress({
			ui,
			usage,
			clock,
			model,
			now,
		})

		// Verify speed is not NaN: 65879 / 4.1 ≈ 16058 T/s (reading)
		assert.ok(lines.some(l => l.includes("reading") && !l.includes("NaNT/s")), "Speed should not be NaN")
		// Verify cost calculation: 65879 * 0.0035 / 1e6 ≈ 0.230576
		assert.ok(lines.some(l => l.includes("0.000231")), "Cost should be calculated correctly")
		const costLine = lines.find(l => l.includes("reading"))?.split(" | ")[4]
		assert.ok(costLine && parseFloat(costLine.slice(1)) > 0, "Reading cost must be positive")
	})

	it("should load and simulate response from files (all files handled)", async () => {
		const ai = new TestAI()
		/** @type {import("ai").ModelMessage[]} */
		const messages = [{ role: "user", content: "Test" }]
		const result = await ai.streamText("test-model", messages)
		const { fullResponse, reasoning, usage, chunks, textStream } = result

		assert.equal(fullResponse, "Hello world!\nAppended stream content")  // answer.md + stream.md
		assert.equal(reasoning, "Thinking...")
		assert.ok(usage instanceof Usage)
		assert.deepStrictEqual(usage.inputTokens, 4)
		assert.deepStrictEqual(usage.reasoningTokens, 2)
		assert.deepStrictEqual(usage.outputTokens, 2)
		assert.deepStrictEqual(usage.totalTokens, 8)
		assert.deepStrictEqual(chunks, [
			{ type: "text-delta", text: "Hello" },
			{ type: "reasoning-delta", text: "Thinking..." },
			{ type: "text-delta", text: " world!" }
		])  // From chunks.jsonl

		// Check streaming and fallback to stream.json
		const streamParts = []
		for await (const part of textStream) streamParts.push(part)
		assert.ok(streamParts.length > 3, "Should yield stream parts including fallback")
		const usagePart = streamParts.find(p => p.type === "usage")
		if (usagePart) {
			assert.deepStrictEqual(usagePart.usage.totalTokens, 8)
		}
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
			assert.ok(usage instanceof Usage)
			assert.ok(usage.totalTokens >= 0) // Estimated usage
		} finally {
			await rm(emptyDir, { recursive: true, force: true })
		}
	})

	it("should log debug files without affecting response", async () => {
		// This test relies on console.debug; in real use, check logs
		// For unit test, verify files are loaded but not in response
		const ai = new TestAI()
		const messages = [{ role: "user", content: "Test" }]
		const result = await ai.streamText("test-model", messages, { cwd: chatDir, step: 1 })
		assert.equal(result.fullResponse, "Hello world!\nAppended stream content")  // No change from debug files
		// In practice, tests.txt, todo.md, unknown.json are logged via console.debug
	})

	it("supports per-step files", async () => {
		const step2Dir = "step/002/"
		await writeFile(resolve(chatDir, step2Dir + "chunks.jsonl"), JSON.stringify([
			{ type: "text-delta", text: "Step 2 response" }
		]))
		await writeFile(resolve(chatDir, step2Dir + "answer.md"), "Step 2 full")

		const ai = new TestAI()
		const result = await ai.streamText("test-model", [], { cwd: chatDir, step: 2 })
		assert.equal(result.fullResponse, "Step 2 full")
	})
})

