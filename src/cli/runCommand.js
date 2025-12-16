import { spawn as defaultSpawn } from "node:child_process"

/**
 * Execute a shell command, return stdout / stderr / exit code.
 *
 * @typedef {{ stdout: string, stderr: string, exitCode: number }} runCommandResult
 * @typedef {(cmd: string, args: string[], opts: object) => Promise<runCommandResult>} runCommandFn
 *
 * @param {string} command
 * @param {string[]} [args=[]]
 * @param {object} [input={}]
 * @param {string} [input.cwd=process.cwd()]
 * @param {(data: string|Error)=>void} [input.onData]
 * @param {(command:string,args:string[],options:object)=>import("node:child_process").ChildProcess} [input.spawn] -
 *   custom spawn implementation for testing, defaults to Node's `spawn`.
 * @returns {Promise<{stdout:string, stderr:string, exitCode:number}>}
 */
export async function runCommand(command, args = [], input = {}) {
	const {
		cwd = process.cwd(),
		onData = d => process.stdout.write(String(d)),
		spawn = defaultSpawn
	} = input

	const child = spawn(command, args, {
		cwd,
		stdio: "pipe",
		shell: true // Allows complex commands with pipes, etc.
	})

	let stdout = ""
	let stderr = ""

	child.stdout?.on("data", chunk => {
		const data = chunk.toString()
		stdout += data
		onData?.(data)
	})

	child.stderr?.on("data", chunk => {
		const data = chunk.toString()
		stderr += data
		onData?.(new Error(data))
	})

	return new Promise((resolve, reject) => {
		child.on("close", code => {
			resolve({
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				exitCode: Number(code || 0)
			})
		})
		child.on("error", reject)
	})
}
