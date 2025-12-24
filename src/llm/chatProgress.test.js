import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { formatChatProgress } from "./chatProgress.js"
import ModelInfo from "./ModelInfo.js"
import LanguageModelUsage from "./LanguageModelUsage.js"

describe("formatChatProgress – baseline", () => {
	describe("Standard multi‑line format", () => {
		it("produces correctly padded lines", () => {
			const usage = new LanguageModelUsage({
				inputTokens: 120_000,
				reasoningTokens: 300,
				outputTokens: 500,
			})
			const now = 1_000_000
			const clock = {
				startTime: now - 80_000,
				reasonTime: now - 3_000,
				answerTime: now - 2_000,
			}
			const model = new ModelInfo({
				pricing: { prompt: 350, completion: 750 },
				context_length: 131_000,
			})

			const lines = formatChatProgress({ usage, clock, model, now })
			assert.deepStrictEqual(lines, [
				"  read | 1:17 | $42.0000 | 120,000T | 1,558T/s",
				"reason | 0:01 |  $0.2250 |     300T |   300T/s",
				"answer | 0:02 |  $0.3750 |     500T |   250T/s",
				"  chat | 1:20 | $42.6000 | 120,800T | 1,510T/s | 10,200T",
			])
		})

		it("handles zero tokens gracefully", () => {
			const usage = new LanguageModelUsage()
			const clock = { startTime: Date.now() }
			const model = new ModelInfo({ context_length: 128_000 })

			const lines = formatChatProgress({ usage, clock, model })
			assert.deepStrictEqual(lines, [
				"chat | 0:00 | $0.000000 | 0T | 0T/s | 128,000T"
			])
		})
	})

	describe("One‑line format (--tiny mode)", () => {
		it("produces single line for tiny mode", () => {
			const usage = new LanguageModelUsage({ inputTokens: 1_000, outputTokens: 100 })
			const now = Date.now()
			const clock = { startTime: now - 1_000, answerTime: now }
			const model = new ModelInfo({ pricing: { prompt: 0.1, completion: 0.2 }, context_length: 128_000 })

			const lines = formatChatProgress({
				usage,
				clock,
				model,
				isTiny: true,
			})
			assert.deepStrictEqual(lines, [
				"step 1 | 1.0s | $0.0001 | answer | 0:00 | 100T | 100T/s | 1,100T | 126,900T"
			])
		})

		it("handles zero tokens in one‑line mode", () => {
			const now = Date.now()
			const usage = new LanguageModelUsage()
			const clock = { startTime: now }
			const model = new ModelInfo({ context_length: 128_000 })

			const lines = formatChatProgress({
				usage,
				clock,
				model,
				isTiny: true,
			})
			assert.deepStrictEqual(lines, [
				"step 1 | 0.0s | $0.0000 | answer | 0.0s | 0T | ∞T/s | 0T | 128,000T"
			])
		})
	})
})
