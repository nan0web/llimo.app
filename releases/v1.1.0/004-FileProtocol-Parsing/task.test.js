/**
 * @todo Detailed English: Enhance FileProtocol in src/FileProtocol.js for robust validation (compare parsed files vs @validate requested list using sorted JSON.stringify for equality, set isValid boolean flag). Improve Markdown parsing in src/utils/Markdown.js to handle nested code blocks (````js for triple-backtick escape in content), extractPath for checklist refs ([-glob](dir) with negatives). Add safeParse in JSONL utils for repairing malformed lines with real newlines in "content" (replace \n → \\n, re-parse, fallback Error).
 *       - Create: src/utils/JSONL.js (extend FileProtocol with safeParse repair logic), src/FileProtocol.js (update validate to use sorted keys, handle maps).
 *       - Tests: src/FileProtocol.test.js (mock parsed, assert isValid true/false), src/utils/Markdown.test.js (nested blocks, extractPath with/without label), src/utils/JSONL.test.js (malformed JSONL repair, error fallback).
 *       Deps: None (core parsing, independent of UI/chat).
 *       Security: Sanitize content (escape injection chars in labels/paths), limit parse depth (prevent DoS from deep nests), validate filename (no /../).
 *       After code: Run tests from tests.txt (parse edge cases), then pnpm test:all for full coverage.
 */

import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import path from "node:path"
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import FileProtocol, { FileEntry, FileError, validate } from "../../../src/FileProtocol.js"
import Markdown from "../../../src/utils/Markdown.js"
import FileSystem from "../../../src/utils/FileSystem.js"
import JSONL from "../../../src/utils/JSONL.js"  // Assume created for task

describe("004-FileProtocol-Parsing – src/FileProtocol.js & src/utils/Markdown.js", () => {
	describe("4.1 Parse markdown source into ParsedFile: correct files, failed errors, @validate", () => {
		it("Parses valid markdown with files/commands into correct[], failed[]", async () => {
			const sampleMd = `
#### [script.js](src/script.js)
\`\`\`js
console.log('parsed content')
\`\`\`
#### [Run](@bash)
\`\`\`bash
pnpm test
\`\`\`
`
			const parsed = await Markdown.parse(sampleMd)
			deepStrictEqual(parsed.correct.length, 2, "Extracts 2 entries: file + command")
			const fileEntry = parsed.correct[0]
			strictEqual(fileEntry.filename, "src/script.js", "Correct filename")
			strictEqual(fileEntry.label, "script.js", "Correct label")
			strictEqual(fileEntry.type, "js", "Correct type")
			ok(fileEntry.content.includes("console.log('parsed content')"), "Correct content")
			const cmdEntry = parsed.correct[1]
			strictEqual(cmdEntry.filename, "@bash", "Command filename")
			strictEqual(parsed.failed.length, 0, "No parse errors")
		})

		it("Handles malformed lines as failed errors with line/content/error details", async () => {
			const invalidMd = `
#### [bad](missing-file.js)  // No code block
Invalid line
#### [nested](test.js)
\`\`\`js
const x = 1
\`\`\`\`js  // Nested escape
More content
\`\`\`
`
			const parsed = await Markdown.parse(invalidMd)
			ok(parsed.failed.length >= 1, "Captures parse errors")
			const err = parsed.failed[0]
			ok(err instanceof FileError, "Error is FileError instance")
			ok(err.line > 0, "Includes line number")
			ok(err.content.includes("bad"), "Includes error content")
			ok(err.error.message.includes("Incorrect file header"), "Descriptive error message")
		})
	})

	describe("4.2 Validate response: compare parsed files vs @validate list, set isValid flag", () => {
		it("Sets isValid=true when parsed files match @validate requested (sorted equality)", async () => {
			const correct = [
				new FileEntry({ filename: "a.js" }),
				new FileEntry({ filename: "@validate", content: "- [a.js](a.js)" })
			]
			const { isValid, requested } = validate(correct)
			strictEqual(isValid, true, "Valid: files match requested sorted list")
			deepStrictEqual(Array.from(requested.keys()), ["a.js"], "Requested from @validate")
		})

		it("Sets isValid=false on mismatch (extra/missing files vs @validate)", async () => {
			const correct = [
				new FileEntry({ filename: "extra.js" }),  // Mismatch
				new FileEntry({ filename: "@validate", content: "- [a.js](a.js)" })
			]
			const { isValid } = validate(correct)
			strictEqual(isValid, false, "Invalid: extra file not in validate")
			// Test missing: correct=[{filename:"a.js"}], validate requests "b.js" → false
			const missingCorrect = [new FileEntry({ filename: "@validate", content: "- [a.js](a.js)" })]
			const { isValid: missingValid } = validate(missingCorrect)
			strictEqual(missingValid, false, "Invalid: missing expected file")
		})

		it("Handles maps (files/requested): Ignores labels for validation, sorts filenames", () => {
			const correct = [
				new FileEntry({ filename: "b.js", label: "B" }),
				new FileEntry({ filename: "a.js", label: "A" }),
				new FileEntry({ filename: "@validate", content: "- [A](a.js)\n- [B](b.js)" })
			]
			const { isValid, files, requested } = validate(correct)
			strictEqual(isValid, true, "Valid: sorted filenames match, labels ignored")
			deepStrictEqual(Array.from(files.keys()).sort(), ["a.js", "b.js"], "Sorted files map")
		})
	})

	describe("4.3 Handle JSONL parsing with safeParse for escaped newlines in content", () => {
		it("Parses standard JSONL, repairs escaped newlines in 'content' field", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "jsonl-4.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			const normalLine = '{"filename":"msg1.jsonl","content":"Line1\\nLine2"}'
			const malformed = '{"filename":"msg2.jsonl","content":"LineA\nLineB"}'  // Real newline breaks parse
			await fs.save("messages.jsonl", `${normalLine}\n${malformed}\n`)
			// Use JSONL parser (extends FileProtocol)
			const parsed = await JSONL.parse("messages.jsonl", fs)  // Assume method to parse file
			// Verify repair: malformed content becomes "LineA\nLineB"
			const msg2 = parsed.correct.find(e => e.filename === "msg2.jsonl")
			strictEqual(msg2.content, "LineA\nLineB", "Repairs real newline to escaped")
			strictEqual(parsed.correct.length, 2, "Parses both lines")
			await rm(tempDir, { recursive: true })
		})

		it("Falls back to FileError on unrepairable JSONL lines (e.g., syntax errors)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "jsonl-error-"))
			const fs = new FileSystem({ cwd: tempDir })
			const badLine = '{"filename":"bad.jsonl","content":"invalid json'  // Unclosed quote
			await fs.save("bad.jsonl", badLine)
			const parsed = await JSONL.parse("bad.jsonl", fs)
			ok(parsed.failed.length === 1, "Captures unrepairable as error")
			const err = parsed.failed[0]
			ok(err.error.message.includes("Unable to parse JSON line"), "Descriptive error")
			await rm(tempDir, { recursive: true })
		})
	})
})
