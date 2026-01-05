import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { FileSystem } from "../../../../src/utils/FileSystem.js"

describe("005-depends-on-pass task", () => {
	it("should pass if 001-pass has pass.txt", async () => {
		const fs = new FileSystem()
		const depPass = await fs.load("../001-pass/pass.txt")
		assert.ok(depPass, "Missing ../001-pass/pass.txt")
		const content = await fs.load("pass.txt")
		assert.ok(content, "pass.txt missing")
		assert.strictEqual(content.trim(), "Dep ended")
	})
})
