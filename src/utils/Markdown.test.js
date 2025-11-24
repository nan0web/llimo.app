import { describe, it } from "node:test"
import assert from "node:assert"
import { Readable } from "node:stream"
import readline from "node:readline"

import Markdown from "./Markdown.js"
import FileSystem from "./FileSystem.js"
import { FileEntry } from "../FileProtocol.js"

const fs = new FileSystem()

describe("Markdown.parseStream", () => {
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
	const stream = readline.createInterface(Readable.from(rows.join("\n")))
	it("should parse with new lines", async () => {
		const result = await Markdown.parseStream(stream)
		assert.deepStrictEqual(result.correct, [
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
		], result.failed)
		assert.deepStrictEqual(result.failed.map(err => [err.line, err.content, err.error]), [
			[1, "# Solution", "Content beyond file"],
			[2, "The content beyond files produces errors", "Content beyond file"],
			[3, " ", "Content beyond file"],
			[14, "", "Content beyond file"],
			[19, "#### [incorrect](file)](file.txt)", "Incorrect file header"],
			[20, "Follow this proven example with tests", "Content beyond file"],
		])
		assert.ok(
			result.isValid,
			"Validate list of files does not match files in response:\n" + result.validate
		)
		for (const { filename, content } of result.correct) {
			await fs.save(`dist/markdown-parseStream.test/${filename}`, content)
		}
	})

	it("should correctly read → parse → save file", async () => {
		const content = await fs.readFile("src/utils/Markdown.test.inject.md", "utf-8")
		const parsed = await Markdown.parse(content)
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
		for (const { filename, content } of parsed.correct) {
			if (filename.startsWith("@")) continue
			await fs.save(`dist/markdown-parse.test/${filename}`, content)
		}
		await fs.save(`dist/markdown-parse.test/source.md`, content)
	})
})
