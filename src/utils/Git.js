import { spawn } from "node:child_process"

/**
 * Simple wrapper for git commands
 */
export default class Git {
	/** @type {string} */
	cwd

	/**
	 * @param {Partial<Git>} [input={}]
	 */
	constructor(input = {}) {
		const { cwd = process.cwd() } = input
		this.cwd = String(cwd)
	}

	/**
	 * Execute a git command
	 * @param {string[]} args
	 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
	 */
	async exec(args, options = {}) {
		const {
			onData = (chunk) => { },
			onError = (chunk) => { },
		} = options
		return new Promise((resolve) => {
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
				resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code || 0 })
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
		await this.exec(["add", "-A"])
		await this.exec(["commit", "-m", message])
	}

	/**
	 * Rename current branch
	 * @param {string} newName
	 */
	async renameBranch(newName) {
		const currentBranch = await this.getCurrentBranch()
		await this.exec(["branch", "-m", currentBranch, newName])
	}

	/**
	 * Push branch to remote
	 * @param {string} name
	 */
	async push(name) {
		await this.exec(["push", "-u", "origin", name])
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
