import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"

describe("progress-demo.test.js", () => {
	it("runs ProgressDemo without prompts", async () => {
		const child = spawn("node", ["play/progress-demo.js"], { stdio: "pipe", encoding: "utf8", env: { ...process.env, DELAY: "0" } })
		const result = await new Promise(r => {
			let out = ""
			let stderr = ""
			child.stdout.on("data", d => out += d)
			child.on("close", code => r({ status: code, stdout: out, stderr }))
		})
		assert.strictEqual(result.status, 0)
		assert.ok(result.stdout.includes("Demo complete!"))
	})
})
