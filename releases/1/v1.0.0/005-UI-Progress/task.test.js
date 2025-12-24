import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { formatChatProgress } from "../../../../src/llm/chatProgress.js"
import { clearDebugger } from "../../../../src/utils/test.js"

const rootDir = resolve("src/llm/chat-progress")

describe("005-UI-Progress – formatChatProgress", () => {
	/** @todo add format for all the different steps: only input usage, read, reason, asnwer */
	describe("5.1 Progress table formats and no NaN", () => {
		it("standard multi-line (no --tiny)", () => {
			const now = Date.now()
			const lines = formatChatProgress({
				usage: { inputTokens: 1000, reasoningTokens: 100, outputTokens: 200 },
				clock: { startTime: now - 5000, reasonTime: now - 3000, answerTime: now - 1000 },
				model: { pricing: { prompt: 0.1, completion: 0.2 } },
				now
			})
			assert.deepStrictEqual(lines, [
				'chat progress | 5.0s | 1,300T | 260T/s | $0.000160',
				'      reading | 2.0s | 1,000T | 500T/s | $0.000100',
				'    reasoning | 2.0s |   100T |  50T/s | $0.000020',
				'    answering | 1.0s |   200T | 200T/s | $0.000040',
			])
		})

		it("one-line (--tiny mode)", () => {
			const now = Date.now()
			const lines = formatChatProgress({
				usage: { inputTokens: 1000, outputTokens: 100 },
				clock: { startTime: now - 1000, answerTime: now },
				model: { pricing: { prompt: 0.1, completion: 0.2 } },
				now,
				isTiny: true // Simulate --tiny flag
			})
			assert.deepStrictEqual(lines, [
				'chat progress | 1.0s |        |     0T/s | $0.000120',
				'      reading | 1.0s | 1,000T | 1,000T/s | $0.000100',
				'    answering | 0.0s |   100T |     0T/s | $0.000020',
			])
		})
	})
})

describe("005-UI-Progress – end-to-end CLI simulation", () => {
	it("standard mode (--debug, multi-line progress)", () => {
		const result = spawnSync("node", [
			resolve(rootDir, "../../../bin/llimo-chat.js"),
			resolve(rootDir, "standard/me.md"),
			"--yes", "--debug"
		], { cwd: resolve(rootDir, "standard"), encoding: "utf8", timeout: 10000 })

		assert.deepStrictEqual(clearDebugger(result.stderr).split("\n"), [""])
		assert.deepStrictEqual(result.stdout.split("\n"), [
			// @todo fix the pre-select
		])
		const output = result.stdout
		assert.strictEqual(result.status, 0)
		assert.ok(output.includes("chat progress |"), "Shows multi-line progress")
		assert.ok(output.match(/step \d+ \| \d+:\d+\.\d+s \| \$[\d.]+\| reading \|/), "Reading phase line")
		assert.ok(!output.includes("step |"), "Not in one-line mode")
	})

	it("one-line mode (--one, single progress line)", () => {
		const script = resolve(rootDir, "../../../bin/llimo-chat.js")
		const mdFile = resolve(rootDir, "one/me.md")
		const result = spawnSync("node", [
			script, mdFile, "--yes", "--one"
		], { cwd: resolve(rootDir, "one"), encoding: "utf8", timeout: 10000 })

		assert.deepStrictEqual(result.output.filter(Boolean).join("\n").split("\n"), [
			// @todo fix the pre-select
		])
	})
})
