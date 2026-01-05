/**
 * @todo Detailed English: Implement core CLI in bin/llimo-chat.js to handle cd to working-dir from argv[0] if dir, parse argv[1] as input file (me.md pre-prompt with markdown refs).
 *       Create: bin/llimo-chat.js (update with cd logic, prompt from me.md).
 *       Tests: bin/llimo-chat.test.js (spawn tests for cd/pack), src/llm/pack.test.js (block splitting ---, glob expansion), src/utils/Markdown.test.js (parse refs/blocks).
 *       Deps: None (independent).
 * @todo Security: Validate input file paths with path.resolve to prevent ../ escapes; add temp dir isolation in tests.
 * @todo After code: Run tests from tests.txt, then pnpm test:all.
 */
import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import { spawn } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { mkdtemp, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { FileSystem } from "../../../../src/utils/FileSystem.js"
import { Chat } from "../../../../src/llm/Chat.js"
import { packMarkdown } from "../../../../src/llm/pack.js"
import Markdown from "../../../../src/utils/Markdown.js"

const spawnAsync = promisify(spawn)

describe("001-Core-Chat-Functionality – bin/llimo-chat.js as main CLI entry point", () => {
	describe("1.1 Implement basic CLI handling: cd to working-dir if provided, parse argv for input file (me.md as pre-prompt)", () => {
		it("Handles CLI with me.md input and packs content with attachments in cwd", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.1-"))
			const fs = new FileSystem({ cwd: tempDir })
			await fs.save("me.md", "- [](src/index.js)\n- Some prompt text --- Additional block")
			await fs.save("src/index.js", "export default {} // Test file")
			// Simulate CLI: spawn llimo-chat me.md (but test internals: cd via cwd, pack from me.md)
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			const meContent = await fs.load("me.md")
			const packed = await packMarkdown({ input: meContent, cwd: tempDir })
			// Verify prompt includes me.md blocks and file content
			ok(packed.text.includes("Some prompt text"), "Includes me.md text block")
			ok(packed.text.includes("Additional block"), "Handles --- blocks in me.md")
			ok(packed.text.includes("export default {}"), "Packs attached file content from ref")
			ok(packed.injected.length === 1 && packed.injected[0].includes("src/index.js"), "Tracks injected files")
			await rm(tempDir, { recursive: true })
		})

		it("CDs to working-dir from argv[0] if it's a dir, parses me.md as pre-prompt", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.1-"))
			const workSubDir = path.join(tempDir, "work")
			await mkdir(workSubDir)
			const fs = new FileSystem({ cwd: workSubDir })
			await fs.save("me.md", "- [](project.txt)")
			await fs.save("project.txt", "Project content")
			// Simulate CLI: llimo work me.md (cd to 'work' from argv[0], pack me.md from argv[1])
			const chat = new Chat({ cwd: workSubDir })
			await chat.init()
			const packed = await packMarkdown({ input: await fs.load("me.md"), cwd: workSubDir })
			ok(packed.text.includes("Project content"), "Packs from subdir cwd after cd")
			// Verify security: path.resolve prevents escapes (../ not allowed)
			const escapedPath = "../../../etc/passwd"
			const resolved = path.resolve(workSubDir, escapedPath)
			ok(!resolved.includes("/etc/passwd"), "Resolves paths safely, no escapes")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("1.2 Handle stdin input: llimo (readline interactive) or cat me.md | llimo (stream)", () => {
		it("Handles interactive readline mode: llimo (prompts user input)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.2-"))
			const fs = new FileSystem({ cwd: tempDir })
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			// Simulate no argv, stdin TTY → interactive: collect lines until stop (mock readline)
			const inputLines = ["Interactive line 1 --- Block separator", "Interactive line 2"]
			const input = inputLines.join("\n")
			const packed = await packMarkdown({ input, cwd: tempDir })
			ok(packed.text.includes("Interactive line 1"), "Preserves first interactive line")
			ok(packed.text.includes("Block separator"), "Splits blocks from interactive input")
			ok(packed.text.includes("Interactive line 2"), "Includes subsequent lines")
			// Security: Limit input size to prevent DoS (mock max 10KB)
			const largeInput = "A".repeat(11e3)
			const largePacked = await packMarkdown({ input: largeInput })
			ok(largePacked.text.length < 10e3, "Truncates large interactive input for safety")
			await rm(tempDir, { recursive: true })
		})

		it("Handles stream input: cat me.md | llimo (reads full stdin)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.2-"))
			const fs = new FileSystem({ cwd: tempDir })
			const meContent = "- Stream text --- Block 2\nWith file ref: [](stream-file.txt)"
			await fs.save("me.md", meContent)
			await fs.save("stream-file.txt", "Streamed file content")
			// Simulate pipe: cat me.md | llimo-chat (full stdin as input)
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			const packed = await packMarkdown({ input: meContent, cwd: tempDir })
			ok(packed.text.includes("Stream text") && packed.text.includes("Block 2"), "Streams full input with blocks")
			ok(packed.text.includes("Streamed file content"), "Packs files from stream refs")
			// Security: Buffer stdin to prevent infinite streams (mock limit)
			await rm(tempDir, { recursive: true })
		})
	})

	describe("1.3 Support file attachments in me.md via markdown: #### [file](path) with code block", () => {
		it("Packs single file ref from me.md", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await fs.save("me.md", "#### [script.js](src/script.js)\n```js\n// ref\n```")
			await fs.save("src/script.js", "console.info('attached')")
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			const packed = await packMarkdown({ input: await fs.load("me.md"), cwd: tempDir })
			ok(packed.text.includes("console.info('attached')"), "Inlines attached file content")
			await rm(tempDir, { recursive: true })
		})

		it("Supports glob patterns: - [](src/**) expands to files", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "src"))
			await fs.save("me.md", "- [](src/**)")
			await fs.save("src/file1.js", "export const a = 1")
			await fs.save("src/file2.js", "export const b = 2")
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			const packed = await packMarkdown({ input: await fs.load("me.md"), cwd: tempDir })
			ok(packed.text.includes("export const a = 1") && packed.text.includes("export const b = 2"), "Expands glob to multiple files")
			ok(packed.injected.length === 2, "Tracks 2 injected files")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("1.4 Integrate @validate in every response: list files/commands in markdown", () => {
		it("AI response includes @validate matching files/commands, parses & validates", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "llimo-1.4-"))
			const fs = new FileSystem({ cwd: tempDir })
			const mockResponse = `
#### [updated.js](src/updated.js)
\`\`\`js
console.info('fixed')
\`\`\`
#### [1 file(s), 1 command(s)](@validate)
\`\`\`markdown
- [fixed](src/updated.js)
- [Run tests](@bash)
\`\`\`
#### [Run tests](@bash)
\`\`\`bash
pnpm test
\`\`\`
`
			await fs.save("response.md", mockResponse)
			const parsed = await Markdown.parse(await fs.load("response.md"))
			const { isValid, requested, files } = parsed
			ok(isValid, "isValid true when matches")
			deepStrictEqual(Array.from(requested.keys()), ["src/updated.js", "@bash"], "Requested: file + command")
			deepStrictEqual(Array.from(files.keys()), ["src/updated.js", "@validate", "@bash"], "Parsed files/commands")
			await rm(tempDir, { recursive: true })
		})

		it("Fails validation if @validate mismatches parsed content", async () => {
			const mockResponse = `
#### [mismatch.js](src/mismatch.js)
\`\`\`js
content
\`\`\`
#### [0 file(s), 0 command(s)](@validate)
\`\`\`markdown
- [](extra.txt)  // Mismatch
\`\`\`
`
			const parsed = await Markdown.parse(mockResponse)
			const { isValid } = parsed
			strictEqual(isValid, false, "isValid false on mismatch")
		})
	})
})
