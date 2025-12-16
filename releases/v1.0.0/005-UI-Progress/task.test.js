import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("005-UI-Progress – src/cli/*, chatProgress.js", () => {
	describe("5.1 Progress table (formatChatProgress)", async () => {
		it("formats progress lines (no NaN)", async () => {
			const progressPath = resolve(rootDir, "src/llm/chatProgress.js")
			const { formatChatProgress } = await import(`file://${progressPath}`)
			const lines = formatChatProgress({
				usage: { inputTokens: 1000, outputTokens: 100 },
				clock: { startTime: Date.now() - 1000 },
				model: { pricing: { prompt: 0.1, completion: 0.2 } }
			})
			assert.ok(lines[0].includes("chat progress"))
			assert.ok(!lines.some(l => l.includes("NaN")), "No NaN speeds/costs")
		})
	})
})
