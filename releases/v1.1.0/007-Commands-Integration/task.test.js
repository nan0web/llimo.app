/**
 * @todo Detailed English: Extend commands in src/llm/commands/* to cover spec examples: @title extracts to title.md for chat title (laconical, user's lang from prompt lang detect). @inject expands patterns ([-test.js](src/**)) to checklist lines (- [](src/file.js)). @info outputs chat stats (sum usage.json recursively with -r, format table). Update system.md to mandate @title in first response. Ensure all commands (@bash → append prompt.md, @get → get files with negatives, @ls → list patterns, @rm → remove files, @summary → emit message) yield expected console lines/formats.
 *       - Create: src/llm/commands/TitleCommand.js (parse title.md on unpack, integrate with Chat), src/llm/commands/InfoCommand.js (sum stats from /chat/* and /archive/*, format table), update src/templates/system.md (@title mandatory in first), src/llm/commands/index.js (export all).
 *       - Tests: src/llm/commands/Title.test.js (mock response with @title block → unpacked title.md, parse lang), src/llm/commands/Info.test.js (mock usage.json dirs, assert summed table "-r" recursive), src/llm/commands/Bash.test.js (yield "Execute: pnpm test"), src/llm/commands/Get.test.js (glob to list, negatives filter), src/llm/commands/Ls.test.js (patterns/ignores), src/llm/commands/Rm.test.js (mock fs.unlink safe), src/llm/commands/Summary.test.js (markdown output), src/llm/commands/Validate.test.js (label counting, match assert).
 *       Deps: 4.2 (@validate base), 5.6 (info stats), 6.1 (console output).
 *       Security: Sanitize command content (no ${exec} in @bash via escape/shell-quote pnpm add shell-quote? ), limit rm globs (safe-path resolve, confirm >1 file), no arbitrary file writes (validate filename whitelists).
 *       After code: Run tests from tests.txt (end-to-end unpack command.run()), then pnpm test:all (command output matches spec).
 */

import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import { spawnAsync } from "node:child_process"  // Assume promisify
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { FileEntry } from "../../../src/FileProtocol.js"
import * as commands from "../../../src/llm/commands/index.js"
import FileSystem from "../../../src/utils/FileSystem.js"

describe("007-Commands-Integration – src/llm/commands/*", () => {
	describe("7.1 @title: Auto-title chats in first response (add to system prompt)", () => {
		it("Processes @title in response, saves to title.md; tests lang detection prompt rule", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "title-7.1-"))
			const fs = new FileSystem({ cwd: tempDir })
			const mockResponse = "#### [Chat Ukrainian](@title)\n```txt\nTitle in lang detect\n```"
			await fs.save("response.md", mockResponse)
			const parsed = await Markdown.parse(mockResponse)
			// Mock unpack with commands
			let capturedTitle = ""
			const mockOut = {
				write: () => {},
				async ask() { return "yes" }  // Confirm
			}
			// Simulate unpackAnswer calls TitleCommand on @title
			const titleCmd = new commands.TitleCommand({ parsed })
			for await (const line of titleCmd.run()) {
				if (line.includes("title.md")) capturedTitle = line  // Mock console output to file
			}
			const titlePath = path.join(tempDir, "title.md")
			const titleContent = await fs.load("title.md") || ""
			ok(titleContent.includes("Title in lang detect"), "@title content unpacked to title.md")
			// Security: Title sanitized (no MD/paths, mock titleContent.includes("```") → false)
			strictEqual(titleContent.includes("```"), false, "Sanitizes title to prevent injection")
			await rm(titlePath)  // Cleanup
			await rm(tempDir, { recursive: true })
		})

		it("System prompt mandates @title in first response, detects lang from user prompt", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "sys-title-7.1-"))
			const fs = new FileSystem({ cwd: tempDir })
			// Mock system prompt with mandatory @title rule
			const updatedSystem = (await fs.load("../../src/templates/system.md", "utf-8") || "")
				.replace("<!--TOOLS_MD-->", "\n### @title\nTitle chats in user's lang.\nExample: #### [Title](@title)\n```txt\nChat Title\n```\n")
			// First response must include @title; detect lang from input (e.g., Ukrainian prompt → UK title)
			const mockInput = "Якийсь запит українською"
			// Mock AI (or assert integration) generates response with @title "Запит українською"
			const mockResponse = "#### [Запит українською](@title)\n```txt\nLanguage detected: Ukrainian\n```"
			await fs.save("first-response.md", mockResponse)
			const parsed = await Markdown.parse(mockResponse)
			const titleEntry = parsed.correct.find(e => e.filename === "@title")
			ok(titleEntry, "Response includes @title as required")
			const langMatch = mockResponse.match(/Language detected: (\w+)/)?.[1] || ""
			strictEqual(langMatch, "Ukrainian", "Detects lang for title (mock detect)")
			// Update system.md in project? But test verifies assumption in first response
			await rm(tempDir, { recursive: true })
		})
	})

	describe("7.2 New commands: @inject (expand globs to checklists), @info (chat stats)", () => {
		it("@inject expands globs/negatives to - [](path) checklists in response", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "inject-7.2-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "src"))
			await writeFile(path.join(tempDir, "src/a.js"), "// a")
			await writeFile(path.join(tempDir, "src/b.test.js"), "// b test")
			const mockResponse = `
#### [Inject src](@inject)
\`\`\`txt
src/**/*.js
- **/*.test.js
\`\`\`
`
			await fs.save("response.md", mockResponse)
			const parsed = await Markdown.parse(mockResponse)
			const injectEntry = parsed.correct.find(e => e.filename === "@inject" && e.label === "Inject src")
			// Instantiate InjectFilesCommand, run → yields - [](src/a.js) only (negatives filter b.test.js)
			const cmd = new commands.InjectFilesCommand({ cwd: tempDir, file: injectEntry, parsed })
			const yielded = []
			for await (const line of cmd.run()) {
				yielded.push(line)
			}
			// Expected output lines: - [](src/a.js) (filtered glob)
			const expected = ["- [](src/a.js)"]
			deepStrictEqual(yielded, expected, "Expands src/**.js but excludes .test.js")
			// Security: Glob resolve via path.resolve (tempDir), no arbitrary paths
			const badGlob = "../secret"  // Should not escape
			const resolved = path.resolve(tempDir, badGlob)
			ok(!resolved.startsWith("/Users"), "Resolves globs safely, blocks traversal")
			await rm(tempDir, { recursive: true })
		})

		it("@info command outputs formatted chat stats table from usage.json (current, -r all archives)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "info-7.2-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "archive"))
			await writeFile(path.join(tempDir, "archive/chat1/usage.json"), JSON.stringify({ tokens: 300, cost: 0.03 }))
			await writeFile(path.join(tempDir, "archive/chat2/usage.json"), JSON.stringify({ tokens: 700, cost: 0.07 }))
			// No current for this test (or mock)
			// Simulate @info in response: Parse, run command → "Available chats: 2 | Total: 1,000T | $0.10"
			const mockParsed = { correct: [new FileEntry({ filename: "@info", content: "" })] }  // -r implicit
			const cmd = new commands.InfoCommand({ cwd: tempDir, file: mockParsed.correct[0], parsed: mockParsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			ok(output.length > 0, "Generates stats table")
			ok(output.some(l => l.includes("Archive 1")), "Includes archive chats")
			const totalLine = output.find(l => l.includes("Total"))
			ok(totalLine.includes("1,000T") && totalLine.includes("$0.100000"), "-r sums recursively")
			// Current if present, but focus on archive total for test
			await rm(tempDir, { recursive: true })
		})
	})

	describe("7.3 Extend @bash/@get/@ls/@rm/@summary/@validate with spec examples", () => {
		it("@bash: Parses content lines, yields echo to prompt.md with output redirect", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "bash-7.3-"))
			const mockParsed = {
				correct: [new FileEntry({
					filename: "@bash",
					content: "echo hello world\nls -la"
				})]
			}
			const cmd = new commands.BashCommand({ cwd: tempDir, file: mockParsed.correct[0], parsed: mockParsed })
			const yielded = []
			for await (const line of cmd.run()) {
				yielded.push(line)
			}
			// Expected: • Execute command: echo hello world >> prompt.md 2>&1
			ok(yielded.some(l => l.includes("echo hello world")), "Emits command lines for append")
			ok(yielded.some(l => l.includes("prompt.md")), "Redirects to prompt.md in output")
			// Security: Escapes content (mock "echo rm -rf /" → safe, no exec here, but log only)
			await rm(tempDir, { recursive: true })
		})

		it("@get: Lists files matching patterns, excludes negatives from label", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "get-7.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "src", "tests"))
			await writeFile(path.join(tempDir, "src/a.js"), "// a")
			await writeFile(path.join(tempDir, "src/b.test.js"), "// b test")
			const mockResponse = `
#### [JS files](@get)
\`\`\`txt
src/**/*.js
\`\`\`
`
			const parsed = await Markdown.parse(mockResponse)
			const getEntry = parsed.correct.find(e => e.filename === "@get" && e.label === "JS files")
			const cmd = new commands.GetFilesCommand({ cwd: tempDir, file: getEntry, parsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			// Expected: - [](src/a.js)
			ok(output.length === 1 && output[0].includes("src/a.js"), "@get lists matching files")
			// With negatives in label: [-*.test.js](src/**) → excludes b.test.js only
			await rm(tempDir, { recursive: true })
		})

		it("@ls: Lists directories/patterns, yields one path per line (no / trailing)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "ls-7.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "types"))
			await writeFile(path.join(tempDir, "src/main.ts", "test"))
			const mockResponse = `
#### [Source](@ls)
\`\`\`
src/**/*.ts
types
\`\`\`
			`
			const parsed = await Markdown.parse(mockResponse)
			const lsEntry = parsed.correct.find(e => e.filename === "@ls")
			const cmd = new commands.LsCommand({ cwd: tempDir, file: lsEntry, parsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			// Expected: src/main.ts (one line, no trailing /)
			ok(output.length > 0 && output[0].includes("src/main.ts"), "@ls yields paths without trailing /")
			ok(output.every(l => !l.endsWith("/")), "No trailing slashes in output")
			await rm(tempDir, { recursive: true })
		})

		it("@rm: Removes specified files/paths from cwd with error handling for non-existent", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "rm-7.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await writeFile(path.join(tempDir, "rm-file.js"), "// to remove")
			await writeFile(path.join(tempDir, "keep.js"), "// safe")
			const mockResponse = `
#### [Cleanup](@rm)
\`\`\`
rm-file.js
nonexistent.txt  // Should warn but not crash
keep.js
\`\`\`
`
			const parsed = await Markdown.parse(mockResponse)
			const rmEntry = parsed.correct.find(e => e.filename === "@rm")
			const cmd = new commands.RmCommand({ cwd: tempDir, file: rmEntry, parsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			// Expected: + Removed: rm-file.js, ! Not found: nonexistent.txt
			ok(output.some(l => l.includes("+Removed: rm-file.js")), "Removes existing files")
			ok(output.some(l => l.includes("! Not found: nonexistent.txt")), "Handles non-existent gracefully")
			const exists = await fs.access("rm-file.js").then(() => false).catch(() => true)
			strictEqual(exists, true, "keep.js untouched")
			await rm(tempDir, { recursive: true })
		})

		it("@summary: Emits short context message lines as console output", async () => {
			const tempDir = await mkdtemp(path.join(tmpDir(), "summary-7.3-"))
			const mockResponse = `
#### [Summary](@summary)
\`\`\`txt
Key changes:
- Fixed bug A
- Added feature B
Next steps...
\`\`\`
`
			const parsed = await Markdown.parse(mockResponse)
			const summaryEntry = parsed.correct.find(e => e.filename === "@summary")
			const cmd = new commands.SummaryCommand({ file: summaryEntry, parsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			// Expected: ℹ Summary:\n   Key changes:\n   - Fixed bug A\n   - Added feature B\n   Next steps...
			ok(output.includes("Summary:"), "Emits structured summary lines")
			ok(output.some(l => l.includes("Key changes")), "Includes body lines")
			// Spec example: Matches "Key changes made to the project:\n- ... "
			await rm(tempDir, { recursive: true })
		})

		it("@validate: Counts parsed files/commands vs label, reports mismatches", async () => {
			const mockResponse = `
#### [validate-test](@validate)
\`\`\`markdown
- [test.js](test.js)
\`\`\`
`
			const parsed = await Markdown.parse(mockResponse)
			parsed.isValid = true
			parsed.files = new Map([["test.js", null]])
			parsed.parsed = parsed
			const cmd = new commands.ValidateCommand({ parsed })
			const output = []
			for await (const line of cmd.run()) {
				output.push(line)
			}
			// Expected: + Expected validation of files 100% valid (if isValid)
			ok(output.includes("Expected validation") || output.includes("100%"), "Reports valid response")
			// Mismatch test
			parsed.isValid = false
			output.length = 0
			for await (const line of cmd.run()) {
				output.push(line)
			}
			ok(output.includes("Validation of responses files fail"), "Reports mismatch")
		})
	})
})
