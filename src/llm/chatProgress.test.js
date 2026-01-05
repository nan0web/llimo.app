import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { formatChatProgress } from "./chatProgress.js"
import ModelInfo from "./ModelInfo.js"
import Usage from "./Usage.js"

const model = new ModelInfo({
	pricing: { prompt: 350, completion: 750 },
	context_length: 131_000,
})
const now = 1_000_000

describe("chatProgress - Standard multi‑line format", () => {
	it("should draw empty progress", () => {
		const usage = new Usage({ inputTokens: 420 })
		const clock = { startTime: now }
		const lines = formatChatProgress({ usage, clock, model, now })
		assert.deepStrictEqual(lines, [
			'read | 0:00 | $0.1470 | 420T | 0T/s',
			'chat | 0:00 | $0.1470 | 420T | 0T/s | 130,580T',
		])
	})
	it("should draw first progress (read)", () => {
		const usage = new Usage({ inputTokens: 420 })
		const clock = { startTime: now - 500 }
		const lines = formatChatProgress({ usage, clock, model, now })
		assert.deepStrictEqual(lines, [
			'read | 0:01 | $0.1470 | 420T | 840T/s',
			'chat | 0:01 | $0.1470 | 420T | 840T/s | 130,580T',
		])
	})
	it("should draw second progress (read + reason)", () => {
		const usage = new Usage({ inputTokens: 420, reasoningTokens: 1 })
		const clock = { startTime: now - 600, reasonTime: now - 100 }
		const lines = formatChatProgress({ usage, clock, model, now })
		assert.deepStrictEqual(lines, [
			'  read | 0:01 | $0.1470 | 420T | 840T/s',
			'reason | 0:00 | $0.0008 |   1T |  10T/s',
			'  chat | 0:01 | $0.1478 | 421T | 702T/s | 130,579T',
		])
	})
	it("should draw third progress (read + reason + asnwer)", () => {
		const usage = new Usage({ inputTokens: 420, reasoningTokens: 1, outputTokens: 30_000 })
		const clock = { startTime: now - 31_600, reasonTime: now - 24_100, answerTime: now - 23_000 }
		const lines = formatChatProgress({ usage, clock, model, now })
		assert.deepStrictEqual(lines, [
			'  read | 0:08 |  $0.1470 |    420T |    56T/s',
			'reason | 0:01 |  $0.0008 |      1T |     1T/s',
			'answer | 0:23 | $22.5000 | 30,000T | 1,304T/s',
			'  chat | 0:32 | $22.6478 | 30,421T |   963T/s | 100,579T',
		])
	})

	it("produces correctly padded lines", () => {
		const usage = new Usage({
			inputTokens: 120_000,
			reasoningTokens: 300,
			outputTokens: 500,
		})
		const clock = {
			startTime: now - 80_000,
			reasonTime: now - 3_000,
			answerTime: now - 2_000,
		}
		const lines = formatChatProgress({ usage, clock, model, now })
		assert.deepStrictEqual(lines, [
			"  read | 1:17 | $42.0000 | 120,000T | 1,558T/s",
			"reason | 0:01 |  $0.2250 |     300T |   300T/s",
			"answer | 0:02 |  $0.3750 |     500T |   250T/s",
			"  chat | 1:20 | $42.6000 | 120,800T | 1,510T/s | 10,200T",
		])
	})
	it("handles zero tokens gracefully", () => {
		const usage = new Usage()
		const clock = { startTime: Date.now() }
		const model = new ModelInfo({ context_length: 128_000 })

		const lines = formatChatProgress({ usage, clock, model })
		assert.deepStrictEqual(lines, [
			"chat | 0:00 | $0.0000 | 0T | 0T/s | 128,000T"
		])
	})
})

describe("chatProgress - One‑line format (--tiny mode)", () => {
	it("should draw empty progress", () => {
		const usage = new Usage({ inputTokens: 420 })
		const clock = { startTime: now }
		const lines = formatChatProgress({ usage, clock, model, now, isTiny: true })
		assert.deepStrictEqual(lines, [
			'step 1 | 0:00 | $0.1470 | read | 0:00 | 420T | ∞T/s | 130,580T of 131,000T',
		])
	})
	it("should draw first progress (read)", () => {
		const usage = new Usage({ inputTokens: 420 })
		const clock = { startTime: now - 500 }
		const lines = formatChatProgress({ usage, clock, model, now, isTiny: true })
		assert.deepStrictEqual(lines, [
			'step 1 | 0:01 | $0.1470 | read | 0:00 | 420T | 840T/s | 130,580T of 131,000T',
		])
	})
	it("should draw second progress (read + reason)", () => {
		const usage = new Usage({ inputTokens: 420, reasoningTokens: 1 })
		const clock = { startTime: now - 600, reasonTime: now - 100 }
		const lines = formatChatProgress({ usage, clock, model, now, isTiny: true })
		assert.deepStrictEqual(lines, [
			'step 1 | 0:01 | $0.1478 | reason | 0:00 | 1T | 10T/s | 130,579T of 131,000T',
		])
	})
	it.todo("should draw third progress (read + reason + asnwer)", () => {
		// @todo fix the calculation in formatChatProgress, because it works for isTiny: false above.
		const usage = new Usage({ inputTokens: 420, reasoningTokens: 1, outputTokens: 30_000 })
		const clock = { startTime: now - 31_600, reasonTime: now - 24_100, answerTime: now - 23_000 }
		const lines = formatChatProgress({ usage, clock, model, now, isTiny: true })
		assert.deepStrictEqual(lines, [
			'step 1 | 0:31 | $22.6478 | answer | 0:23 | 30,000T | 963T/s | 100,579T of 131,000T',
		])
	})

	it.todo("produces single line for tiny mode", () => {
		// @todo fix the calculation in formatChatProgress, because it works for isTiny: false above.
		const usage = new Usage({ inputTokens: 1_000, outputTokens: 100 })
		const clock = { startTime: now - 120_000, answerTime: now - 100_000 }
		const model = new ModelInfo({ pricing: { prompt: 0.1, completion: 0.2 }, context_length: 128_000 })

		const lines = formatChatProgress({
			usage,
			clock,
			model,
			now,
			isTiny: true,
		})
		assert.deepStrictEqual(lines, [
			"step 1 | 2:00 | $0.0001 | answer | 1:40 | 100T | 9T/s | 126,900T of 128,000T"
		])
	})

	it("handles zero tokens in one‑line mode", () => {
		const usage = new Usage()
		const clock = { startTime: now }
		const model = new ModelInfo({ context_length: 128_000 })

		const lines = formatChatProgress({
			usage,
			clock,
			model,
			now,
			isTiny: true,
		})
		assert.deepStrictEqual(lines, [
			"step 1 | 0:00 | $0.0000 | read | 0:00 | 0T | ∞T/s | 128,000T of 128,000T"
		])
	})
})
