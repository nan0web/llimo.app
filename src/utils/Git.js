import { spawn } from "node:child_process"

/**
 * Simple wrapper for git commands
 */
export class Git {
	/** @type {string} */
	cwd
	/** @type {boolean} */
	dry

	/**
	 * @param {Partial<Git>} [input={}]
	 */
	constructor(input = {}) {
		const { cwd = process.cwd(), dry = false } = input
		this.cwd = String(cwd)
		this.dry = Boolean(dry)
	}

	/**
	 * Execute a git command
	 * @param {string[]} args
	 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, command: string}>}
	 */
	async exec(args, options = {}) {
		const {
			onData = (chunk) => { },
			onError = (chunk) => { },
		} = options
		return new Promise((resolve) => {
			const command = ["git", ...args].join(" ")
			if (this.dry) {
				return { stdout: "", stderr: "", exitCode: 0, command }
			}
			const child = spawn("git", args, {
				cwd: this.cwd,
				stdio: ["pipe", "pipe", "pipe"],
			})
			let stdout = ""
			let stderr = ""

			child.stdout.on("data", (d) => {
				stdout += d
				onData(d)
			})
			child.stderr.on("data", (d) => {
				stderr += d
				onError(d)
			})

			child.on("close", (code) => {
				resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code || 0, command })
			})
		})
	}

	/**
	 * Create a new branch
	 * @param {string} name
	 */
	async createBranch(name) {
		await this.exec(["checkout", "-b", name])
	}

	/**
	 * Add all changes and commit
	 * @param {string} message
	 */
	async commitAll(message) {
		const result = []
		result.push(await this.exec(["add", "-A"]))
		result.push(await this.exec(["commit", "-m", message]))
	}

	/**
	 * Rename current branch
	 * @param {string} newName
	 */
	async renameBranch(newName) {
		const currentBranch = await this.getCurrentBranch()
		return await this.exec(["branch", "-m", currentBranch, newName])
	}

	/**
	 * Push branch to remote
	 * @param {string} name
	 */
	async push(name) {
		return await this.exec(["push", "-u", "origin", name])
	}

	/**
	 * Get the current branch name
	 * @returns {Promise<string>}
	 */
	async getCurrentBranch() {
		const { stdout } = await this.exec(["rev-parse", "--abbrev-ref", "HEAD"])
		return stdout
	}
}
