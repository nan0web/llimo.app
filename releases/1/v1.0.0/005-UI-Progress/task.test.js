import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { clearDebugger } from "../../../../src/utils/test.js"
import { formatChatProgress } from "../../../../src/llm/chatProgress.js"
import { Ui }from "../../../../src/cli/Ui.js"

const rootDir = resolve("src/llm/chat-progress")

describe("005-UI-Progress – formatChatProgress", () => {
	const ui = new Ui()
	const now = Date.now()
	/** @todo add format for all the different steps: only input usage, read, reason, asnwer */
	describe("5.1 Progress table formats and no NaN", () => {
		it("standard multi-line - read", () => {
			const lines = formatChatProgress({
				ui,
				usage: { inputTokens: 1_000 },
				clock: { startTime: now - 5000 },
				model: { context_length: 16_000, pricing: { prompt: 0.1, completion: 0.2 } },
				now,
			})
			assert.deepStrictEqual(lines, [
				'read | 0:05 | $0.0001 | 1,000T | 200T/s',
				'chat | 0:05 | $0.0001 | 1,000T | 200T/s | 15,000T',
			])
		})
		it("standard multi-line - reason", () => {
			const lines = formatChatProgress({
				ui,
				usage: { inputTokens: 1_000, reasoningTokens: 2_000 },
				clock: { startTime: now - 5000, reasonTime: now - 2000 },
				model: { context_length: 16_000, pricing: { prompt: 0.1, completion: 0.2 } },
				now,
			})
			assert.deepStrictEqual(lines, [
				'  read | 0:03 | $0.0001 | 1,000T |   333T/s',
				'reason | 0:02 | $0.0004 | 2,000T | 1,000T/s',
				'  chat | 0:05 | $0.0005 | 3,000T |   600T/s | 13,000T'
			])
		})
		it("standard multi-line - answer", () => {
			const lines = formatChatProgress({
				ui,
				usage: { inputTokens: 1_000, outputTokens: 2_000 },
				clock: { startTime: now - 5000, answerTime: now - 2000 },
				model: { context_length: 16_000, pricing: { prompt: 0.1, completion: 0.2 } },
				now,
			})
			assert.deepStrictEqual(lines, [
				'  read | 0:03 | $0.0001 | 1,000T |   333T/s',
				'answer | 0:02 | $0.0004 | 2,000T | 1,000T/s',
				'  chat | 0:05 | $0.0005 | 3,000T |   600T/s | 13,000T'
			])
		})
		it("standard multi-line - complete", () => {
			const lines = formatChatProgress({
				ui,
				usage: { inputTokens: 1_000, reasoningTokens: 1_000, outputTokens: 2_000 },
				clock: { startTime: now - 5000, reasonTime: now - 3000, answerTime: now - 1000 },
				model: { context_length: 16_000, pricing: { prompt: 0.1, completion: 0.2 } },
				now,
			})
			assert.deepStrictEqual(lines, [
				'  read | 0:02 | $0.0001 | 1,000T |   500T/s',
				'reason | 0:02 | $0.0002 | 1,000T |   500T/s',
				'answer | 0:01 | $0.0004 | 2,000T | 2,000T/s',
				'  chat | 0:05 | $0.0007 | 4,000T |   800T/s | 12,000T',
			])
		})

		it("one-line (--tiny mode)", () => {
			const lines = formatChatProgress({
				ui,
				usage: { inputTokens: 1_000, outputTokens: 100 },
				clock: { startTime: now - 1_000, answerTime: now },
				model: { context_length: 128_000, pricing: { prompt: 0.1, completion: 0.2 } },
				now,
				isTiny: true
			})
			assert.deepStrictEqual(lines, [
				"step 1 | 1.0s | $0.0001 | answer | 0:00 | 100T | 100T/s | 1,100T | 126,900T"
			])
		})
	})
})

describe.skip("005-UI-Progress – end-to-end CLI simulation", () => {
	it("standard mode (--debug, multi-line progress)", () => {
		const result = spawnSync("node", [resolve(rootDir, "../../../bin/llimo-chat.js"), resolve(rootDir, "standard/me.md"), "--yes", "--debug"], { cwd: resolve(rootDir, "standard"), encoding: "utf8", timeout: 20000 })
		const output = clearDebugger(result.stdout).slice(0, 1000).trim()  // Limit for assertion
		assert.ok(output.includes("chat progress |"), "Shows chat progress first line")
		assert.ok(output.includes("reading |"), "Shows phase lines")
		assert.ok(output.includes("$0.00"), "Cost is calculated")
		assert.ok(!output.includes("step 3 |"), "Not one-line mode")
	})

	it("one-line mode (--one, single progress line)", () => {
		const result = spawnSync("node", [resolve(rootDir, "../../../bin/llimo-chat.js"), resolve(rootDir, "one/me.md"), "--yes", "--one"], { cwd: resolve(rootDir, "one"), encoding: "utf8", timeout: 20000 })
		const output = clearDebugger(result.stdout).slice(0, 200).trim()  // Limit for assertion
		assert.ok(output.includes("step 4 |"), "Shows single-step progress line")
		assert.ok(output.includes("$0.00"), "Cost is present")
	})
})
