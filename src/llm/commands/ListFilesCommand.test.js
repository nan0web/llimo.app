import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import Markdown from "../../utils/Markdown.js"
import ListFilesCommand from "./ListFilesCommand.js"

describe("ListFilesCommand", () => {
	let workdir

	before(async () => {
		workdir = await mkdtemp(resolve(tmpdir(), "llimo-ls-"))
		await mkdir(resolve(workdir, "src"), { recursive: true })
		await mkdir(resolve(workdir, "node_modules", "package"), { recursive: true })
		await mkdir(resolve(workdir, ".git"), { recursive: true })
		await Promise.all([
			writeFile(resolve(workdir, "src/app.js"), "// app", "utf-8"),
			writeFile(resolve(workdir, "src/util.test.js"), "// test", "utf-8"),
			writeFile(resolve(workdir, "src/readme.txt"), "readme", "utf-8"),
			writeFile(resolve(workdir, "node_modules/package/index.js"), "// npm", "utf-8"),
			writeFile(resolve(workdir, ".git/config"), "[core]\n", "utf-8"),
		])
	})

	after(async () => {
		if (workdir) await rm(workdir, { recursive: true, force: true })
	})

	it("should list files respecting patterns", async () => {
		const markdown = `
#### [List](@ls)
\`\`\`txt
src/**
\`\`\`
`
		const parsed = await Markdown.parse(markdown)
		const file = parsed.correct.find((e) => e.filename === "@ls")
		assert.ok(file, "Expected @ls entry")

		const cmd = new ListFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		assert.deepStrictEqual(out, [
			'src/app.js',
			'src/readme.txt',
			'src/util.test.js'
		])
	})

	it("should ignore node_modules and .git by default", async () => {
		const markdown = `
#### [List all](@ls)
\`\`\`txt
**/*
\`\`\`
`
		const parsed = await Markdown.parse(markdown)
		const file = parsed.correct.find((e) => e.filename === "@ls")
		assert.ok(file, "Expected @ls entry")

		const cmd = new ListFilesCommand({ cwd: workdir, file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// Should not contain node_modules or .git files
		assert.deepStrictEqual(out, [
			'src/app.js',
			'src/readme.txt',
			'src/util.test.js'
		])
	})
})

