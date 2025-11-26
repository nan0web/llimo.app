/**
 * Integration tests for the `llimo‑unpack.js` CLI.
 *
 * The tests run the script in an **isolated temporary directory** so that
 * no repository files are touched.  A lightweight helper `execScript`
 * spawns a child process and captures **both** stdout and stderr.
 *
 * Covered behaviours:
 *   • Regular file unpacking.
 *   • @summary command.
 *   • @rm command (temporary workspace).
 *   • Unknown command handling (asserted on *stderr*).
 *   • --dry mode (no files written).
 *
 * @module bin/llimo-unpack.test
 */

import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import {
	readFile,
	writeFile,
	mkdtemp,
	rm,
} from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

/** Absolute path to the script under test */
const unpackScript = new URL("../bin/llimo-unpack.js", import.meta.url).pathname

/**
 * Execute the CLI in a child process, piping optional STDIN data.
 *
 * @param {Object} opts
 * @param {string} opts.cwd          – Working directory for the child.
 * @param {string[]} [opts.args]    – CLI arguments (e.g. `--dry`).
 * @param {string} [opts.input]     – Markdown data to pipe to STDIN.
 * @returns {Promise<{ stdout:string, stderr:string, exitCode:number }>}
 */
function execScript({ cwd, args = [], input = "" }) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [unpackScript, ...args], {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
		})

		let stdout = ""
		let stderr = ""

		child.stdout.on("data", (d) => (stdout += d))
		child.stderr.on("data", (d) => (stderr += d))

		child.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code })
		})

		if (input) {
			child.stdin.write(input)
		}
		child.stdin.end()
	})
}

/**
 * Build a minimal markdown fragment for a file or a command.
 *
 * @param {Array<{filename:string,content?:string,label?:string,type?:string}>} entries
 * @returns {string} Markdown suitable for feeding to llimo‑unpack.
 */
function buildMarkdown(entries) {
	const out = []
	for (const e of entries) {
		const title = e.label ?? e.filename
		const ext = (e.filename.match(/\.(\w+)$/)?.[1]) ?? "txt"
		out.push(`#### [${title}](${e.filename})`)
		out.push("```" + ext)
		out.push(e.content ?? "")
		out.push("```")
	}
	return out.join("\n")
}

/**
 * Create a fresh temporary workspace.
 *
 * @returns {Promise<string>} Absolute path of the directory.
 */
async function createTempWorkspace() {
	return await mkdtemp(join(tmpdir(), "llimo-unpack-"))
}

/** Recursively delete a directory. */
async function cleanWorkspace(dir) {
	if (dir) {
		await rm(dir, { recursive: true, force: true })
	}
}

/* -------------------------------------------------------------------------- */

describe("llimo‑unpack CLI", () => {
	let tempDir

	/** One temporary directory for the whole suite. */
	before(async () => {
		tempDir = await createTempWorkspace()
	})

	/** Remove the temporary workspace after all tests. */
	after(async () => {
		await cleanWorkspace(tempDir)
		tempDir = undefined
	})

	it("unpacks a single regular file", async () => {
		const md = buildMarkdown([
			{ filename: "hello.txt", content: "Hello world!" },
		])

		const { stdout, exitCode } = await execScript({
			cwd: tempDir,
			input: md,
		})

		assert.strictEqual(exitCode, 0, "CLI should exit with code 0")
		assert.match(stdout, /\+ hello\.txt/, "Should report a saved file")

		const saved = await readFile(join(tempDir, "hello.txt"), "utf-8")
		// `llimo‑unpack` keeps the trailing newline from the markdown block.
		// Normalise it for the assertion.
		assert.strictEqual(saved.trimEnd(), "Hello world!")
	})

	it("processes @summary command", async () => {
		const md = buildMarkdown([{
			filename: "@summary",
			label: "Release notes",
			type: "txt",
			content: "Version 1.2.3\n- Fixed bugs\n- Added feature X",
		}])

		const { stdout, exitCode } = await execScript({
			cwd: tempDir,
			input: md,
		})

		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /Summary:/, "Summary header should be printed")
		assert.match(stdout, /Version 1\.2\.3/, "Summary body should be printed")
	})

	it("processes @rm command in the temporary workspace", async () => {
		// 1️⃣ Create a file that will be removed.
		const filePath = join(tempDir, "temp-to-delete.txt")
		await writeFile(filePath, "will be removed", "utf-8")

		// 2️⃣ Build markdown that asks llimo‑unpack to delete it.
		const md = buildMarkdown([{
			filename: "@rm",
			label: "Cleanup",
			type: "txt",
			content: "temp-to-delete.txt",
		}])

		const { stdout, exitCode } = await execScript({
			cwd: tempDir,
			input: md,
		})

		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /Removing files/, "Should announce removal")
		assert.match(stdout, /Removed: temp-to-delete\.txt/, "Should confirm successful removal")

		// 3️⃣ Verify the file no longer exists.
		await assert.rejects(() => readFile(filePath, "utf-8"), {
			code: "ENOENT",
		}, "File must be deleted")
	})

	it("gracefully handles unknown commands", async () => {
		const md = buildMarkdown([{
			filename: "@unknown",
			label: "Mystery",
			type: "txt",
			content: "some data",
		}])

		const { stdout, stderr, exitCode } = await execScript({
			cwd: tempDir,
			input: md,
		})

		assert.strictEqual(exitCode, 0)

		// The warning is emitted via `console.error`, which goes to **stderr**.
		assert.match(stderr, /Unknown command: @unknown/, "Should warn about unknown command")
		assert.match(stderr, /Available commands:/, "Should list available commands")
		// Ensure the normal progress line is still printed to stdout.
		assert.match(stdout, /Extracting files/, "Should show the generic header")
	})

	it("honours the --dry flag (no files are written)", async () => {
		const md = buildMarkdown([{
			filename: "dry.txt",
			content: "Do not persist",
		}])

		const { stdout, exitCode } = await execScript({
			cwd: tempDir,
			args: ["--dry"],
			input: md,
		})

		assert.strictEqual(exitCode, 0)
		assert.match(stdout, /dry mode/, "Should announce dry mode")
		// In dry mode the script shows a "•" marker instead of "+".
		assert.match(stdout, /• dry\.txt/, "Should display a skip marker")
		// Verify that the file was **not** created.
		await assert.rejects(() => readFile(join(tempDir, "dry.txt"), "utf-8"), {
			code: "ENOENT",
		})
	})
})
