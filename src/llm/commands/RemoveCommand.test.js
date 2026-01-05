import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { MarkdownProtocol } from "../../utils/Markdown.js"
import RemoveCommand from "./RemoveCommand.js"

describe("RemoveCommand", () => {
	let workdir

	before(async () => {
		workdir = await mkdtemp(resolve(tmpdir(), "llimo-rm-"))
		// Create subdirectory first
		await mkdir(resolve(workdir, "subdir"), { recursive: true })
		// Create some test files
		await Promise.all([
			writeFile(resolve(workdir, "temp.txt"), "temp", "utf-8"),
			writeFile(resolve(workdir, "keep.txt"), "keep", "utf-8"),
			writeFile(resolve(workdir, "subdir/another.txt"), "another", "utf-8"),
		])
	})

	after(async () => {
		if (workdir) await rm(workdir, { recursive: true, force: true })
	})

	it("should remove specified files", async () => {
		const markdown = `
#### [Clean up](@rm)
\`\`\`txt
temp.txt
subdir/another.txt
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@rm")
		assert.ok(file, "Expected @rm entry")

		const cmd = new RemoveCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)
		assert.deepStrictEqual(out, [
			' • Removing files:',
			' + Removed: temp.txt',
			' + Removed: subdir/another.txt',
		])

		// Verify files are actually gone
		try {
			await access(resolve(workdir, "temp.txt"))
			assert.fail("File should have been removed")
		} catch {
			assert.ok(true, "File was successfully removed")
		}
	})

	it("should handle non-existent files gracefully", async () => {
		const markdown = `
#### [Remove non-existent](@rm)
\`\`\`txt
does-not-exist.txt
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@rm")
		assert.ok(file, "Expected @rm entry")

		const cmd = new RemoveCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		assert.deepStrictEqual(out, [
			' • Removing files:',
			' ! Not found: does-not-exist.txt'
		])
	})
})
