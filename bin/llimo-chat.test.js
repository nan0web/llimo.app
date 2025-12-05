import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"
import { runNodeScript, cleanupTempDir, createTempWorkspace } from "../src/test-utils.js"

describe("llimo-chat – integration tests via script execution", () => {
	it("runs in test mode with --test-dir", async () => {
		const testDir = await createTempWorkspace({
			"prompt.md": "# Test prompt\nSimulate this.",
			"answer-step1.md": "Simulated answer",
			"chunks.json": JSON.stringify([{ type: "text-delta", text: "Hello" }])
		})

		const { stdout, stderr, exitCode } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: "./bin/llimo-chat.js",
			args: ["--test", testDir],
			input: "" // No additional input
		})

		assert.strictEqual(exitCode, 0)
		assert.ok(stdout.includes("Test mode enabled"))
		assert.ok(stdout.includes("Simulating chat step"))
		assert.ok(stdout.includes("✅ Test simulation complete"))
		assert.strictEqual(stderr, "")

		await cleanupTempDir(testDir)
	})

	it("handles missing prompt.md in test mode (error)", async () => {
		const testDir = await createTempWorkspace({}) // Empty dir

		const { stdout, stderr, exitCode } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: "./bin/llimo-chat.js",
			args: ["--test", testDir]
		})

		assert.notStrictEqual(exitCode, 0)
		assert.ok(stderr.includes("No input provided and no prompt.md"))
	})
})
