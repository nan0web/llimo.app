/**
 * Integration tests for the `llimo-unpack.js` script.
 *
 * The tests use the helper `runNodeScript` (defined in `src/test-utils.js`)
 * which creates an isolated temporary working directory for each run.
 *
 * The goal is to verify that:
 *   • Files are correctly written to the temporary cwd.
 *   • Commands (`@bash`, `@rm`, `@summary`, `@validate`, `@get`) are processed
 *     without affecting the repository files.
 *   • The script exits with code 0 even when encountering unknown commands.
 *
 * @module bin/llimo-unpack.test
 */

import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { runNodeScript, cleanupTempDir } from "../src/test-utils.js"

// Path to the script under test (relative to this file).
const unpackScript = new URL("../bin/llimo-unpack.js", import.meta.url).pathname

/**
 * Helper that builds a minimal markdown fragment representing a file or a command.
 *
 * @param {Array<{filename:string,content?:string,label?:string,type?:string}>} entries
 * @returns {string}
 */
function buildMarkdown(entries) {
	const out = []
	for (const e of entries) {
		const title = e.label ?? e.filename
		const ext = (e.filename.match(/\.(\w+)$/)?.[1]) || "txt"
		out.push(`#### [${title}](${e.filename})`)
		out.push("```" + ext)
		out.push(e.content ?? "")
		out.push("```")
	}
	return out.join("\n")
}

describe("llimo‑unpack script", () => {
	let tempDir

	/** Create a fresh temporary directory before the suite starts */
	before(async () => {
		const result = await runNodeScript({ scriptPath: unpackScript })
		tempDir = result.tempDir
	})

	/** Remove the temporary directory after the suite finishes */
	after(async () => {
		if (tempDir) await cleanupTempDir(tempDir)
		tempDir = undefined
	})

	it("unpacks a single regular file", async () => {
		const md = buildMarkdown([{ filename: "hello.txt", content: "Hello world!" }])
		const { stdout, exitCode, tempDir: td } = await runNodeScript({
			cwd: tempDir,
			scriptPath: unpackScript,
			inputData: md,
		})
		assert.strictEqual(exitCode, 0, "Should exit successfully")
		assert.match(stdout, /\+ hello\.txt/, "Should report a saved file")
		const saved = await readFile(join(td, "hello.txt"), "utf-8")
		assert.strictEqual(saved, "Hello world!")
	})

	it("processes @summary command", async () => {
		const md = buildMarkdown([{
			filename: "@summary",
			label: "Release notes",
			type: "txt",
			content: "Version 1.2.3\n- Fixed bugs\n- Added feature X"
		}])
		const { stdout, exitCode } = await runNodeScript({
			cwd: tempDir,
			scriptPath: unpackScript,
			inputData: md,
		})
		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /Summary:/, "Should display the summary header")
		assert.match(stdout, /Version 1\.2\.3/, "Should include the summary body")
	})

	it("processes @rm command in a temporary workspace", async () => {
		// 1️⃣ Create a file that will be removed
		const filePath = join(tempDir, "temp-to-delete.txt")
		await writeFile(filePath, "will be removed", "utf-8")

		// 2️⃣ Build markdown that asks the script to delete it
		const md = buildMarkdown([{
			filename: "@rm",
			label: "Cleanup",
			type: "txt",
			content: "temp-to-delete.txt"
		}])

		const { stdout, exitCode } = await runNodeScript({
			cwd: tempDir,
			scriptPath: unpackScript,
			inputData: md,
		})

		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /Removing files/, "Should announce removal")
		assert.match(stdout, /Removed: temp-to-delete\.txt/, "Should confirm removal")

		// 3️⃣ Verify the file no longer exists
		await assert.rejects(() => readFile(filePath, "utf-8"), {
			code: "ENOENT"
		}, "File should have been deleted")
	})

	it("gracefully handles unknown commands", async () => {
		const md = buildMarkdown([{
			filename: "@unknown",
			label: "Mystery",
			type: "txt",
			content: "some data"
		}])
		const { stdout, exitCode } = await runNodeScript({
			cwd: tempDir,
			scriptPath: unpackScript,
			inputData: md,
		})
		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /Unknown command: @unknown/, "Should warn about unknown command")
		assert.match(stdout, /Available commands:/, "Should list available commands")
	})

	it("honours the --dry flag (no files are written)", async () => {
		const md = buildMarkdown([{
			filename: "dry.txt",
			content: "Do not persist"
		}])
		const { stdout, exitCode } = await runNodeScript({
			cwd: tempDir,
			scriptPath: unpackScript,
			args: ["--dry"],
			inputData: md,
		})
		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /dry mode/, "Should announce dry mode")
		// In dry mode the script uses the "•" marker instead of "+"
		assert.match(stdout, /• dry\.txt/, "Should show a skip marker")
		// Verify file does NOT exist
		await assert.rejects(() => readFile(join(tempDir, "dry.txt"), "utf-8"), {
			code: "ENOENT"
		})
	})
})
