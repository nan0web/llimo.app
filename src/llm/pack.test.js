import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { packMarkdown } from "./pack.js"
import { FileSystem } from "../utils.js"

describe("pack module", () => {
	let tempDir

	before(async () => {
		tempDir = await mkdtemp(resolve(tmpdir(), "llimo-system-test-"))
		const fs = new FileSystem({ cwd: tempDir })
		await fs.save("src/index.js", "export default {}")
		await fs.save("src/File.js", "export default class File {}")
		await fs.save("src/File.test.js", "import { describe, it } from 'node:test'")
		await fs.save("types/index.d.ts", "// nothing here")
	})

	after(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true })
		}
	})

	it("should pack message with files", async () => {
		const input = [
			"- [-**/*.test.js](src/**)",
			"- [Types](types/index.d.ts)"
		].join("\n")
		const out = []
		const onRead = (dir, entries) => {
			out.push({ dir, entries })
		}
		debugger
		const { injected, text } = await packMarkdown({ input, cwd: tempDir, onRead })
		assert.deepStrictEqual(out, [
			{ dir: "src", entries: ["src/File.js", "src/index.js"] },
		])
		assert.deepStrictEqual(injected, [
			"  - src/File.js 28 bytes",
			"  - src/index.js 17 bytes",
			"  - types/index.d.ts 15 bytes",
		])
		assert.ok(text.includes("export default {}"))
		assert.ok(text.includes("export default class File {}"))
	})
})
