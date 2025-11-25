/**
 * Integration tests for the llimo‑pack.js script.
 *
 * The tests reuse shared helpers from `test/utils.js`.
 *
 * @module bin/llimo‑pack.test
 */

import { describe, it, after } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
import { runNodeScript, cleanupTempDir } from "../src/test-utils.js"

// Path to the script under test (relative to this test file).
const packScript = resolve(__dirname, "llimo-pack.js")

/**
 * Helper that builds a minimal markdown checklist string for the given file paths.
 * The format matches the parser inside `llimo-pack.js`:
 *   - [](<path>)   // empty name – the script will fallback to basename
 *   - [MyName](<path>) // optional explicit name
 */
function buildMarkdownChecklist(paths) {
	return paths.map(p => `- [](${p})`).join("\n")
}

/**
 * Helper that builds a markdown checklist with explicit names.
 */
function buildNamedMarkdown(items) {
	// items: [{name:string, path:string}]
	return items.map(i => `- [${i.name}](${i.path})`).join("\n")
}

describe("llimo‑pack script", () => {
	let tempDir

	after(async () => {
		if (tempDir) {
			// await cleanupTempDir(tempDir)
			console.info(`rm -rf ${tempDir}`)
		}
		tempDir = undefined
	})

	it("should pack a single file from stdin markdown", async () => {
		const markdown = buildMarkdownChecklist(["bin/llimo-pack.js"])
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: packScript,
			inputData: markdown
		})
		tempDir = td
		assert.strictEqual(exitCode, 0, "Script should exit with code 0")
		// Expected output fragment – header line and fenced code block.
		assert.match(stdout, /#### \[llimo-pack.js\]\(bin\/llimo-pack.js\)/)
		assert.match(stdout, /```js/)
		assert.ok(stdout.includes("#!/usr/bin/env node"), stdout)
	})

	it("should pack multiple files from stdin markdown", async () => {
		const markdown = buildMarkdownChecklist([
			"bin/llimo-unpack.js",
			"bin/llimo-unpack.test.js"
		])
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			scriptPath: packScript,
			inputData: markdown
		})
		tempDir = td
		assert.strictEqual(exitCode, 0)
		// Both files must appear in order.
		assert.match(stdout, /#### \[llimo-unpack.js\]\(bin\/llimo-unpack.js\)/)
		assert.match(stdout, /#### \[llimo-unpack.test.js\]\(bin\/llimo-unpack.test.js\)/)
		// Verify there are exactly two fenced blocks.
		const fences = stdout.match(/```js/g) || []
		assert.strictEqual(fences.length, 2, "Should generate two js code fences")
	})

	it("should honour explicit names in the markdown checklist", async () => {
		const markdown = buildNamedMarkdown([
			{ name: "Unpacker", path: "bin/llimo-unpack.js" },
			{ name: "UnpackerTest", path: "bin/llimo-unpack.test.js" }
		])
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			scriptPath: packScript,
			inputData: markdown
		})
		tempDir = td
		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /#### \[Unpacker\]\(bin\/llimo-unpack.js\)/)
		assert.match(stdout, /#### \[UnpackerTest\]\(bin\/llimo-unpack.test.js\)/)
	})

	it("should write packed markdown to a destination file when a second argument is given", async () => {
		const markdown = buildMarkdownChecklist(["bin/llimo-unpack.js"])
		const outFile = "dist/llimo-packed-output.md"
		const { stderr, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: packScript,
			args: [outFile], // second argument – output path (relative to cwd)
			inputData: markdown,
		})
		// The script prints a summary line to stdout – we only care that it exits cleanly.
		assert.strictEqual(exitCode, 0)
		// Verify the file was created inside the temporary cwd.
		const outPath = resolve(td, outFile)
		const written = await readFile(outPath, "utf-8")
		assert.match(written, /#### \[llimo-unpack.js\]\(bin\/llimo-unpack.js\)/)
		assert.match(written, /```js/)
		// The helper should have returned the tempDir used as cwd.
		tempDir = td
	})

	it("should ignore non‑checklist lines and preserve them verbatim", async () => {
		const markdown = [
			"# Some Title",
			"A paragraph before the checklist.",
			"- [](bin/llimo-unpack.js)",
			"Another paragraph after.",
			"- [](bin/llimo-unpack.test.js)"
		].join("\n")
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			scriptPath: packScript,
			inputData: markdown
		})
		tempDir = td
		assert.strictEqual(exitCode, 0)
		// Title and paragraphs must appear unchanged.
		assert.match(stdout, /# Some Title/)
		assert.match(stdout, /A paragraph before the checklist\./)
		assert.match(stdout, /Another paragraph after\./)
		// Checklist items should be transformed, not left as "+ [](...)
		assert.doesNotMatch(stdout, /- \[\]\(bin\/llimo-unpack.js\)/)
	})

	it("should emit an error line when a referenced file cannot be read, but continue processing", async () => {
		const markdown = buildMarkdownChecklist([
			"does-not-exist.txt",
			"bin/llimo-unpack.js"
		])
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: packScript,
			inputData: markdown
		})
		tempDir = td
		// The script never aborts – it should exit with 0 even if one file fails.
		assert.strictEqual(exitCode, 0)
		// Error message should be present in stdout (the script prints errors via console.error).
		assert.match(stdout, /ERROR: Could not read file/)
		// The valid file must still be packed.
		assert.match(stdout, /#### \[llimo-unpack.js\]\(bin\/llimo-unpack.js\)/)
	})
})
