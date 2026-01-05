import { describe, it } from "node:test"
import assert from "node:assert"
import { Readable } from "node:stream"
import readline from "node:readline"

import { MarkdownProtocol } from "./Markdown.js"
import { FileSystem } from "./FileSystem.js"
import { FileEntry } from "../FileProtocol.js"

const fs = new FileSystem()

describe.skip("MarkdownProtocol.parseStream", () => {
	const rows = [
		'# Solution',
		'The content beyond files produces errors',
		' ',
		'#### [](system.md)',
		'```markdown',
		'# System instructions',
		'',
		'Provide all the answers with markdown format in files.',
		'Check the validation to be sure:',
		'````js',
		'const x = 9',
		'````',
		'```',
		'',
		'#### [Updated](play/main.js)',
		'```js',
		'import process from "node:process"',
		'```',
		'#### [incorrect](file)](file.txt)',
		'Follow this proven example with tests',
		'#### [Setting up the project](@bash)',
		'```bash',
		'pnpm add ai @ai-sdk/cerebras',
		'cat package.json',
		'```',
		'#### [2 file(s), 1 command(s)](@validate)',
		'```markdown',
		'- [](system.md)',
		'- [Updated](play/main.js)',
		'- [Setting up the project](@bash)',
		'```',
	]
	const entries = [
		new FileEntry({
			filename: "system.md", type: "markdown", content: [
				"# System instructions",
				'',
				'Provide all the answers with markdown format in files.',
				'Check the validation to be sure:',
				'```js',
				'const x = 9',
				'```',
			].join("\n")
		}),
		new FileEntry({
			label: "Updated", filename: "play/main.js", type: "js", content: [
				'import process from "node:process"',
				'',
			].join("\n")
		}),
		new FileEntry({
			label: "Setting up the project", filename: "@bash", type: "bash", content: [
				'pnpm add ai @ai-sdk/cerebras',
				'cat package.json',
				'',
			].join("\n")
		}),
		new FileEntry({
			label: "2 file(s), 1 command(s)", filename: "@validate", type: "markdown", content: [
				'- [](system.md)',
				'- [Updated](play/main.js)',
				'- [Setting up the project](@bash)',
				'',
			].join("\n")
		})
	]
	const stream = readline.createInterface(Readable.from(rows.join("\n")))
	it("should parse with new lines", async () => {
		const result = await MarkdownProtocol.parseStream(stream)
		assert.deepStrictEqual(result.correct, entries)
		assert.deepStrictEqual(result.failed?.map(err => [err.line, err.content, err.error]), [
			[19, "#### [incorrect](file)](file.txt)", "Incorrect file header"],
		])
		for (const { filename, content } of result.correct) {
			if (filename.startsWith("@")) continue
			await fs.save(`dist/markdown-parseStream.test/${filename}`, content)
		}
	})

	it("should parse content beyond file", async () => {
		const result = await MarkdownProtocol.parse(rows.join("\n"))
		assert.deepStrictEqual(result.correct, entries)
		assert.deepStrictEqual(result.failed?.map(err => [err.line, err.content, err.error]), [
			[19, "#### [incorrect](file)](file.txt)", "Incorrect file header"],
		])
		assert.ok(
			result.isValid,
			"Validate list of files does not match files in response:\n" + result.validate
		)
		for (const { filename, content } of result.correct) {
			if (filename.startsWith("@")) continue
			await fs.save(`dist/markdown-parse.test/${filename}`, content)
		}
	})

	it("should correctly read → parse → save file", async () => {
		const content = await fs.readFile("src/utils/MarkdownProtocol.test.inject.md", "utf-8")
		const parsed = await MarkdownProtocol.parse(content)
		assert.equal(parsed.isValid, false)
		assert.deepStrictEqual(parsed.requested, new Map([
			["bin/llimo-pack.js", "llimo-pack.js"],
			["bin/llimo-unpack.js", "llimo-unpack.js"],
			["bin/llimo-chat.js", "llimo-chat.js"],
			["bin/llimo-chat.test.js", "llimo-chat.test.js"],
			["src/cli/argvHelper.js", "argvHelper.js"],
			["src/llm/commands/InjectFilesCommand.js", "InjectFilesCommand.js"],
			["src/utils/FileSystem.js", "FileSystem.js"],
		]))
		assert.deepStrictEqual(parsed.files, new Map([
			["src/utils/FileSystem.js", "src/utils/FileSystem.js"],
			["src/llm/commands/InjectFilesCommand.js", "src/llm/commands/InjectFilesCommand.js"],
		]))
		for (const { filename, content } of (parsed.correct ?? [])) {
			if (filename.startsWith("@")) continue
			await fs.save(`dist/markdown-parse.test/${filename}`, content)
		}
		await fs.save(`dist/markdown-parse.test/source.md`, content)
	})
})


describe("MarkdownProtocol.extractPath", () => {
	describe("extractPath helper", () => {
		it("returns null for non‑checklist lines", () => {
			assert.strictEqual(MarkdownProtocol.extractPath("# Title"), null)
			assert.strictEqual(MarkdownProtocol.extractPath("- not a checklist"), null)
		})

		it("parses empty name correctly", () => {
			const res = MarkdownProtocol.extractPath("- [](path/to/file.js)")
			assert.deepStrictEqual(res, { name: "", path: "path/to/file.js" })
		})

		it("parses explicit name correctly", () => {
			const res = MarkdownProtocol.extractPath("- [MyFile](src/file.js)")
			assert.deepStrictEqual(res, { name: "MyFile", path: "src/file.js" })
		})

		it("rejects malformed headers", () => {
			assert.strictEqual(MarkdownProtocol.extractPath("- [MissingParen]src/file.js"), null)
		})
	})
})
