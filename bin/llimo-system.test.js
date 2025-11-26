/**
 * Integration tests for the llimo‑system.js script.
 *
 * The tests reuse shared helpers from `src/test-utils.js`.
 *
 * @module bin/llimo-system.test
 */

import { describe, it, after } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
import { runNodeScript, cleanupTempDir } from "../src/test-utils.js"

// Path to the script under test (relative to this test file).
const systemScript = resolve(__dirname, "llimo-system.js")

describe("llimo‑system script", () => {
	let tempDir

	after(async () => {
		if (tempDir) {
			// await cleanupTempDir(tempDir)
			console.log(`rm -rf ${tempDir}`)
		}
		tempDir = undefined
	})

	it("should output system prompt to stdout by default", async () => {
		const { stdout, stderr, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript
		})
		tempDir = td
		console.log(exitCode, stderr)
		assert.strictEqual(exitCode, 0, "Script should exit with code 0")
		// Should contain system prompt template
		assert.match(stdout, /You are a helpful assistant/, "Should contain system prompt")
		// Should contain tools list
		assert.match(stdout, /validate, ls, get, bash, rm, summary/, "Should list available tools")
	})

	it.skip("should write system prompt to file when argument provided", async () => {
		const outFile = "dist/system.md"
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript,
			args: [outFile]
		})
		tempDir = td
		assert.strictEqual(exitCode, 0, "Script should exit with code 0")
		// Verify the file was created inside the temporary cwd.
		const outPath = resolve(td, outFile)
		const written = await readFile(outPath, "utf-8")
		assert.match(written, /You are a helpful assistant/, "Should contain system prompt")
		assert.match(written, /<!--TOOLS_LIST-->/, "Should contain placeholder")
		assert.match(written, /<!--TOOLS_MD-->/, "Should contain placeholder")
	})

	it.skip("should include all available commands in the output", async () => {
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			scriptPath: systemScript
		})
		tempDir = td
		assert.strictEqual(exitCode, 0)
		// Check that all expected commands are mentioned
		const expectedCommands = ["validate", "ls", "get", "bash", "rm", "summary"]
		for (const cmd of expectedCommands) {
			assert.match(stdout, new RegExp(cmd), `Should include ${cmd} command`)
		}
	})

	it.skip("should replace template placeholders correctly", async () => {
		const outFile = "dist/system-with-placeholders.md"
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript,
			args: [outFile]
		})
		tempDir = td
		assert.strictEqual(exitCode, 0)
		const outPath = resolve(td, outFile)
		const written = await readFile(outPath, "utf-8")

		// Placeholders should be replaced with actual content
		assert.doesNotMatch(written, /<!--TOOLS_LIST-->/, "TOOLS_LIST placeholder should be replaced")
		assert.doesNotMatch(written, /<!--TOOLS_MD-->/, "TOOLS_MD placeholder should be replaced")

		// Should contain actual command list
		assert.match(written, /validate, ls, get, bash, rm, summary/, "Should contain actual tools list")

		// Should contain command documentation
		assert.match(written, /### ValidateCommand/, "Should contain ValidateCommand docs")
		assert.match(written, /### BashCommand/, "Should contain BashCommand docs")
	})
})

