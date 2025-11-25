/**
 * Test utilities for running Node.js scripts in isolated environments
 */

import { spawn } from "node:child_process"
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"

/**
 * Execute a Node.js script in an isolated temporary directory
 * @param {Object} options
 * @param {string} options.cwd - Original working directory
 * @param {string} options.scriptPath - Path to the script to execute
 * @param {string[]} [options.args=[]] - Arguments to pass to the script
 * @param {string} [options.input] - Data to pipe to stdin
 * @returns {Promise<{ stdout:string, stderr:string, exitCode:number, tempDir:string }>}
 */
export async function runNodeScript({ cwd, scriptPath, args = [], input = "" }) {
	// Create a unique temporary directory for this test run
	const tempDir = await mkdtemp(join(tmpdir(), `llimo-test-${randomUUID().slice(0, 8)}-`))

	// Copy the script to temp directory to ensure it's isolated
	const scriptName = scriptPath.split('/').pop()
	const tempScriptPath = join(tempDir, scriptName)
	const scriptContent = await readFile(scriptPath, 'utf-8')
	await writeFile(tempScriptPath, scriptContent, 'utf-8')

	// Make script executable
	await writeFile(tempScriptPath + ".test", scriptContent, 'utf-8')

	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [tempScriptPath, ...args], {
			cwd: tempDir,
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				// Prevent any git operations in temp directory
				GIT_DIR: undefined,
				GIT_WORK_TREE: undefined
			}
		})

		let stdout = ""
		let stderr = ""

		child.stdout.on("data", (d) => (stdout += d))
		child.stderr.on("data", (d) => (stderr += d))

		child.on("close", (code) => {
			resolve({
				stdout,
				stderr,
				exitCode: code ?? 0,
				tempDir
			})
		})

		child.on("error", (err) => {
			reject(err)
		})

		if (input) {
			child.stdin.write(input)
		}
		child.stdin.end()
	})
}

/**
 * Clean up a temporary directory safely
 * @param {string} tempDir - Directory to clean up
 */
export async function cleanupTempDir(tempDir) {
	if (!tempDir) return

	// Double-check we're in a temporary directory
	if (!tempDir.includes(tmpdir()) && !tempDir.includes('llimo-test-')) {
		console.warn(`⚠️  Refusing to delete non-temp directory: ${tempDir}`)
		return
	}

	try {
		await rm(tempDir, { recursive: true, force: true })
	} catch (/** @type {any} */ error) {
		console.warn(`⚠️  Failed to clean up temp dir ${tempDir}:`, error.message)
	}
}

/**
 * Create a temporary workspace with test files
 * @param {Object} files - Map of filename -> content
 * @returns {Promise<string>} - Path to temporary directory
 */
export async function createTempWorkspace(files = {}) {
	const tempDir = await mkdtemp(join(tmpdir(), `llimo-workspace-${randomUUID().slice(0, 8)}-`))

	for (const [filename, content] of Object.entries(files)) {
		const filePath = join(tempDir, filename)
		await writeFile(filePath, content, 'utf-8')
	}

	return tempDir
}
