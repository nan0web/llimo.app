import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { MarkdownProtocol } from "../../utils/Markdown.js"
import GetFilesCommand from "./GetFilesCommand.js"

describe("GetFilesCommand", () => {
	let workdir

	// -----------------------------------------------------------------
	// Build a tiny temporary project with a few files.
	// -----------------------------------------------------------------
	before(async () => {
		workdir = await mkdtemp(resolve(tmpdir(), "llimo-getfiles-"))
		await mkdir(resolve(workdir, "src"), { recursive: true })
		// Create nested directories first
		await mkdir(resolve(workdir, "node_modules", "package"), { recursive: true })
		await mkdir(resolve(workdir, ".git"), { recursive: true })
		await Promise.all([
			writeFile(resolve(workdir, "src/app.js"), "// app", "utf-8"),
			writeFile(resolve(workdir, "src/util.test.js"), "// test", "utf-8"),
			writeFile(resolve(workdir, "src/extra.test.jsx"), "// test jsx", "utf-8"),
			writeFile(resolve(workdir, "src/readme.txt"), "readme", "utf-8"),
			writeFile(resolve(workdir, "node_modules/package/index.js"), "// npm", "utf-8"),
			writeFile(resolve(workdir, ".git/config"), "[core]\n", "utf-8"),
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
		const parsed = await MarkdownProtocol.parse(markdown)

		// Locate the @get entry
		const file = parsed.correct?.find((e) => e.filename === "@get")
		assert.ok(file, "Expected @get entry")

		const cmd = new GetFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// We expect the two non-test files to be emitted.
		assert.deepStrictEqual(out, [
			"- [](src/app.js)",
			"- [](src/readme.txt)",
		])
	})

	it("should ignore node_modules and .git by default", async () => {
		const markdown = `
#### [](@get)
\`\`\`txt
**/*
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@get")
		assert.ok(file, "Expected @get entry")

		const cmd = new GetFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// Should not contain node_modules or .git files
		assert.deepStrictEqual(out, [
			'- [](src/app.js)',
			'- [](src/extra.test.jsx)',
			'- [](src/readme.txt)',
			'- [](src/util.test.js)'
		])
	})

	it("should handle multiple patterns", async () => {
		const markdown = `
#### [](@get)
\`\`\`txt
src/app.js
src/readme.txt
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@get")
		assert.ok(file, "Expected @get entry")

		const cmd = new GetFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		assert.deepStrictEqual(out, [
			"- [](src/app.js)",
			"- [](src/readme.txt)",
		])
	})
})
