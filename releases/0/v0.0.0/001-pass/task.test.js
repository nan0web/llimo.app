import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { FileSystem } from "../../../../src/utils/FileSystem.js"

describe("001-pass task", () => {
	it("should create pass.txt", async () => {
		const fs = new FileSystem()
		const content = await fs.load("pass.txt")
		assert.ok(content, "pass.txt should exist")
		assert.strictEqual(content.trim(), "Task passed")
	})
})
