import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createTempWorkspace, runNodeScript, cleanupTempDir } from "./test-utils.js"

describe("test-utils – workspace and script execution", () => {
	let tempDir

	beforeEach(async () => {
		tempDir = await createTempWorkspace({
			"test.txt": "Hello, world!",
			"nested/sub.js": "console.log('sub')"
		})
	})

	afterEach(async () => {
		await cleanupTempDir(tempDir)
	})

	it("createTempWorkspace creates files correctly", async () => {
		const content = await readFile(join(tempDir, "test.txt"), "utf-8")
		assert.strictEqual(content, "Hello, world!")

		const subContent = await readFile(join(tempDir, "nested/sub.js"), "utf-8")
		assert.strictEqual(subContent, "console.log('sub')")
	})

	describe("runNodeScript", () => {
		it("executes a simple echo script", async () => {
			// Create a simple test script
			const echoScriptPath = join(tempDir, "echo.js")
			await writeFile(echoScriptPath, `
import process from "node:process";
const args = process.argv.slice(2);
console.log("Echo:", ...args);
`)

			const { stdout, stderr, exitCode } = await runNodeScript({
				cwd: tempDir,
				scriptPath: echoScriptPath,
				args: ["Hello from test"]
			})

			assert.strictEqual(exitCode, 0)
			assert.strictEqual(stderr, "")
			assert.ok(stdout.includes("Echo: Hello from test"))
		})
	})
})
