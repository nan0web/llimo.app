import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "node:child_process"

describe("001-Release-Workflow", () => {
	it("llimo release scans NOTES.md → tasks, parallel worktrees", () => {
		// Mock exec 'llimo release releases/ibank/v2.0.0'
		const out = execSync("llimo release releases/ibank/v2.0.0", { encoding: "utf8" })
		assert.ok(out.includes("27 tasks"), "Processes all tasks")
	})
	it("llimo stats shows pass/fail per branch", () => {
		const stats = execSync("llimo stats", { encoding: "utf8" })
		assert.ok(stats.match(/v2\.0\.0\.\d+.*(complete|fail)/), "Shows status")
	})
})
