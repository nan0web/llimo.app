import { describe, it } from "node:test"
import assert from "node:assert"
import { formatChatProgress } from "./chatProgress.js"
import ModelInfo from "./ModelInfo.js"

describe("formatChatProgress – pure formatting logic", () => {
	it("produces correctly padded lines", () => {
		const usage = { inputTokens: 1200, reasoningTokens: 300, outputTokens: 500, totalTokens: 2000 }
		const now = 1e6
		const clock = {
			startTime: now - 5e4,
			reasonTime: now - 3e3,
			answerTime: now - 2e3,
		}
		const model = new ModelInfo({
			pricing: { prompt: 0.00035, completion: 0.00075 },
		})

		const lines = formatChatProgress({
			elapsed: 5,
			usage,
			clock,
			model,
			now
		})
		assert.deepStrictEqual(lines, [
			'chat progress | 50.0s | 2,000T |  40T/s | $1.020000',
			'      reading | 47.0s | 1,200T |  26T/s | $0.420000',
			'    reasoning |  1.0s |   300T | 300T/s | $0.225000',
			'    answering |  2.0s |   500T | 250T/s | $0.375000',
		])
	})
})
