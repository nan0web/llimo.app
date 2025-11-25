/**
 * Integration tests for the llimo-system.js script.
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
			console.info(`rm -rf ${tempDir}`)
			await cleanupTempDir(tempDir)
		}
		tempDir = undefined
	})

	it("should output system prompt to stdout by default", async () => {
		const { stdout, exitCode } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript
		})
		assert.strictEqual(exitCode, 0, "Script should exit with code 0")
		// Should contain tools list
		assert.match(stdout, /<!--TOOLS_LIST-->/)
		// Should contain tools documentation
		assert.match(stdout, /### validate/)
		assert.match(stdout, /### ls/)
		assert.match(stdout, /### get/)
		assert.match(stdout, /### bash/)
		assert.match(stdout, /### rm/)
		assert.match(stdout, /### summary/)
	})

	it("should write system prompt to file when argument provided", async () => {
		const outFile = "system-output.md"
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript,
			args: [outFile]
		})
		tempDir = td
		assert.strictEqual(exitCode, 0, "Script should exit with code 0")
		// Should confirm file was saved
		assert.match(stdout, /\+ File has been saved/)
		assert.match(stdout, new RegExp(`\\+ ${outFile}`))
		// Verify the file was created
		const outPath = resolve(tempDir, outFile)
		const written = await readFile(outPath, "utf-8")
		assert.match(written, /<!--TOOLS_LIST-->/)
		assert.match(written, /### validate/)
	})

	it("should include all available commands in the output", async () => {
		const { stdout, exitCode } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript
		})
		assert.strictEqual(exitCode, 0)
		
		// Check that all commands are documented
		const expectedCommands = ['validate', 'ls', 'get', 'bash', 'rm', 'summary']
		for (const cmd of expectedCommands) {
			assert.match(stdout, new RegExp(`### ${cmd}`), `Missing documentation for ${cmd}`)
		}
	})

	it("should replace template placeholders correctly", async () => {
		const { stdout, exitCode } = await runNodeScript({
			cwd: process.cwd(),
			scriptPath: systemScript
		})
		assert.strictEqual(exitCode, 0)
		
		// Tools list should be replaced (not contain the placeholder)
		assert.doesNotMatch(stdout, /<!--TOOLS_LIST-->/, "Tools list placeholder should be replaced")
		// Tools markdown should be replaced
		assert.doesNotMatch(stdout, /<!--TOOLS_MD-->/, "Tools markdown placeholder should be replaced")
		// Should contain actual tools
		assert.match(stdout, /validate, ls, get, bash, rm, summary/)
	})
})
