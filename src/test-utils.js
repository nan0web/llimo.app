/**
 * Test utilities for running Node.js scripts in isolated environments.
 */

import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * Execute a Node.js script in a temporary directory.
 *
 * @param {Object} options
 * @param {string} options.scriptPath - Path to the script to execute
 * @param {string[]} [options.args=[]] - Arguments to pass to the script
 * @param {string} [options.inputData] - Data to pipe to stdin
 * @param {string} [options.cwd] - Working directory (defaults to temp dir)
 * @returns {Promise<{ stdout:string, stderr:string, exitCode:number, tempDir:string }>}
 */
export async function runNodeScript(options) {
	const { scriptPath, args = [], inputData, cwd } = options

	// Create temporary directory if not provided
	const tempDir = cwd || await mkdtemp(join(tmpdir(), `llimo-test-${randomUUID().slice(0, 8)}-`))

	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [scriptPath, ...args], {
			cwd: tempDir,
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				NODE_OPTIONS: "--import=tsx/node"
			}
		})

		let stdout = ""
		let stderr = ""

		child.stdout.on("data", (d) => (stdout += d))
		child.stderr.on("data", (d) => (stderr += d))

		child.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code || 0, tempDir })
		})

		child.on("error", reject)

		if (inputData) {
			child.stdin.write(inputData)
		}
		child.stdin.end()
	})
}

/**
 * Clean up a temporary directory.
 *
 * @param {string} dir - Directory to remove
 */
export async function cleanupTempDir(dir) {
	if (dir) {
		await rm(dir, { recursive: true, force: true })
	}
}
