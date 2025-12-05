import { describe, it } from "node:test"
import assert from "node:assert"
import { formatChatProgress } from "./chatProgress.js"
import ModelInfo from "./ModelInfo.js"
import LanguageModelUsage from "./LanguageModelUsage.js"

describe("formatChatProgress – pure formatting logic", () => {
	it("produces correctly padded lines", () => {
		const usage = new LanguageModelUsage({ inputTokens: 120_000, reasoningTokens: 300, outputTokens: 500, totalTokens: 2000 })
		const now = 1e6
		const clock = {
			startTime: now - 5e4,  // 50 seconds ago
			reasonTime: now - 3e3,  // 3s ago
			answerTime: now - 2e3,  // 2s ago
		}
		// Use pricing per 1M tokens: 0.00035 per token = 350 per 1M
		const model = new ModelInfo({
			pricing: { prompt: 350, completion: 750 },
		})

		// Remove explicit 'elapsed' to use calculation from clock
		const lines = formatChatProgress({
			usage,
			clock,
			model,
			now
		})
		assert.deepStrictEqual(lines, [
			'chat progress | 50.0s | 120,800T | 2,416T/s | $42.600000',
			'      reading | 47.0s | 120,000T | 2,553T/s | $42.000000',
			'    reasoning |  1.0s |     300T |   300T/s |  $0.225000',
			'    answering |  2.0s |     500T |   250T/s |  $0.375000',
		])
	})

	it.todo("add tests with different chunks to see the closest test to real life", async () => {
		// @todo write a test to imitate chatProgress
	})

	it("handles zero tokens gracefully", () => {
		const usage = new LanguageModelUsage()
		const clock = { startTime: Date.now() }
		const model = new ModelInfo()

		const lines = formatChatProgress({ usage, clock, model })
		assert.strictEqual(lines.length, 1)
		assert.ok(lines[0].startsWith("chat progress"))
	})
})
