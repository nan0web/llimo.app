import { describe, it, before } from "node:test"
import assert from "node:assert"

import { ReleaseProtocol } from "./Release.js"
import { FileSystem } from "./FileSystem.js"

const fs = new FileSystem()

describe("Release.parseStream", () => {
	/** @type {string} */
	let content = ""
	before(async () => {
		content = await fs.readFile("src/utils/Release.test.md", "utf-8") ?? ""
	})

	it("should correctly read → parse → save file", async () => {
		const parsed = ReleaseProtocol.parse(content)
		assert.deepStrictEqual(parsed.title, "LLiMo v1.0.0 Release Notes")
		assert.deepStrictEqual(parsed.tasks.map(
			({ label, link, text }) => [Boolean(label), parseInt(link.slice(0, 3)), Boolean(text)]
		), [
			[true, 1, true],
			[true, 2, true],
			[true, 3, true],
			[true, 4, true],
			[true, 5, true],
			[true, 6, true],
			[true, 7, true],
			[true, 8, true],
			[true, 9, true],
		])
	})
})

