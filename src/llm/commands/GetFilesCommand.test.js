import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import Markdown from "../../utils/Markdown.js"
import GetFilesCommand from "./GetFilesCommand.js"

describe("GetFilesCommand", () => {
	let workdir

	// -----------------------------------------------------------------
	// Build a tiny temporary project with a few files.
	// -----------------------------------------------------------------
	before(async () => {
		workdir = await mkdtemp(resolve(tmpdir(), "llimo-getfiles-"))
		await mkdir(resolve(workdir, "src"), { recursive: true })
		await Promise.all([
			writeFile(resolve(workdir, "src/app.js"), "// app", "utf-8"),
			writeFile(resolve(workdir, "src/util.test.js"), "// test", "utf-8"),
			writeFile(resolve(workdir, "src/extra.test.jsx"), "// test jsx", "utf-8"),
			writeFile(resolve(workdir, "src/readme.txt"), "readme", "utf-8"),
		])
	})

	after(async () => {
		if (workdir) await rm(workdir, { recursive: true, force: true })
	})

	it("should list files respecting negative patterns", async () => {
		const markdown = `
#### [-**/*.test.js;-**/*.test.jsx](@get)
\`\`\`txt
src/**
\`\`\`
`
		// Parse the markdown in the temporary cwd so that the FileProtocol
		// resolves paths relative to the temp project.
		const parsed = await Markdown.parse(markdown)

		// Locate the @get entry
		const file = parsed.correct.find((e) => e.filename === "@get")
		assert.ok(file, "Expected @get entry")

		const cmd = new GetFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// We expect the two non‑test files to be emitted.
		const expected = [
			"- [](src/app.js)",
			"- [](src/readme.txt)",
		]

		assert.deepStrictEqual(out.sort(), expected.sort())
	})
})
