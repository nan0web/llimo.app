import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Runs a Node.js script with optional input and arguments.
 * @param {Object} options
 * @param {string} options.scriptPath - Path to the script.
 * @param {string} [options.inputData] - Data to pipe to stdin.
 * @param {string[]} [options.args] - Arguments to pass.
 * @param {string} [options.cwd] - Working directory.
 * @param {string} [options.tempDir] - Temp dir to use as cwd.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, tempDir: string}>}
 */
export async function runNodeScript({ scriptPath, inputData, args = [], cwd, tempDir }) {
	const workingDir = cwd ?? tempDir ?? await mkdtemp(resolve(tmpdir(), 'llimo-test-'))

	if (inputData && !args.includes('prompt.md')) {
		try {
			await rm(resolve(workingDir, 'prompt.md'))
		} catch {}
	} else {
		const promptPath = resolve(workingDir, 'prompt.md')
		await writeFile(promptPath, inputData || '')
	}

	const child = spawn('node', [scriptPath, ...args], {
		cwd: cwd ?? workingDir,
		stdio: ['pipe', 'pipe', 'pipe'],
		env: { ...process.env, NODE_ENV: 'test' }
	})

	let stdout = ''
	let stderr = ''

	child.stdout.on('data', (data) => stdout += data.toString())
	child.stderr.on('data', (data) => stderr += data.toString())

	if (inputData) {
		child.stdin.write(inputData)
		child.stdin.end()
	}

	const exitCode = await new Promise((resolve) => child.on('close', resolve))

	if (!tempDir) {
		await rm(workingDir, { recursive: true, force: true })
	}

	return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode, tempDir: workingDir }
}

/**
 * Cleans up a temporary directory.
 * @param {string} tempDir
 */
export async function cleanupTempDir(tempDir) {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true })
	}
}
