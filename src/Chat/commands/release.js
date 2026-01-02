import { spawn } from "node:child_process"

import { parseArgv } from "../../cli/argvHelper.js"
import { Alert } from "../../cli/components/index.js"
import Ui, { UiCommand } from "../../cli/Ui.js"
import FileSystem from "../../utils/FileSystem.js"
import ReleaseProtocol from "../../utils/Release.js"
import UiOutput from "../../cli/UiOutput.js"
import Chat from "../../llm/Chat.js"

/**
 * @typedef {{ label: string, link: string, text: string }} Task
 */

/**
 * Options for the `release` command.
 */
export class ReleaseOptions {
	/** @type {string} */
	release
	static release = {
		alias: "v",
		help: "Release directory path e.g. 'releases/1/v1.0.0'",
		default: ""
	}
	/** @type {number} */
	threads
	static threads = {
		alias: "t",
		help: "Max parallel tasks",
		default: 4
	}
	/** @type {number} */
	attempts
	static attempts = {
		alias: "a",
		help: "Max retries per task on fail",
		default: 9
	}
	/** @type {boolean} */
	docker
	static docker = {
		alias: "d",
		help: "Run tasks in Docker",
		default: false
	}
	/** @type {string} */
	temp
	static temp = {
		help: "Base for temp worktrees",
		default: "/tmp"
	}
	dry
	static dry = {
		alias: "r",
		help: "Dry mode to output commands instead of executing them",
		default: false
	}
	constructor(input = {}) {
		const props = {}
		for (const [name, el] of Object.entries(ReleaseOptions)) {
			if (el.alias && "undefined" !== typeof input[el.alias]) {
				props[name] = input[el.alias]
			} else {
				props[name] = input[name]
			}
		}
		const {
			release = ReleaseOptions.release.default,
			threads = ReleaseOptions.threads.default,
			attempts = ReleaseOptions.attempts.default,
			docker = ReleaseOptions.docker.default,
			temp = ReleaseOptions.temp.default,
			dry = ReleaseOptions.dry.default,
		} = props
		this.release = String(release)
		this.threads = Number(threads)
		this.attempts = Number(attempts)
		this.docker = Boolean(docker)
		this.temp = String(temp)
		this.dry = Boolean(dry)
	}
}

/**
 * `release` command – processes release tasks from NOTES.md in parallel using git worktrees.
 */
export class ReleaseCommand extends UiCommand {
	static name = "release"
	static help = "Process release tasks from NOTES.md using git worktrees and llimo chat"
	options = new ReleaseOptions()
	fs = new FileSystem()
	ui = new Ui()
	chat = new Chat()
	/**
	 * @param {Partial<ReleaseCommand>} input
	 */
	constructor(input = {}) {
		super()
		const {
			options = this.options,
			fs = this.fs,
			ui = this.ui,
			chat = this.chat,
		} = input
		this.options = options
		this.fs = fs
		this.ui = ui
		this.chat = chat
	}
	/**
	 * @throws
	 * @param {object} [options]
	 * @param {function({ task: any, chunk: any }): void} [options.onData]
	 * @returns {AsyncGenerator<UiOutput | boolean>}
	 */
	async * run(options = {}) {
		const {
			onData = () => { },
		} = options
		const baseDir = "releases"
		const release = new ReleaseProtocol({ version: this.options.release })
		let versions = await this.fs.browse(this.fs.path.resolve(baseDir), { recursive: true, depth: 2 })
		versions = versions.map(v => v.split("/").slice(1, -1).join("/")).filter(Boolean)
		if (!this.options.release) {
			yield new Alert({ text: `Provide (--release or -v) version, available versions:\n- ${versions.join("\n- ")}`, variant: "error" })
			return
		}
		yield new Alert({ text: `Available versions:\n- ${versions.join("\n- ")}`, variant: "debug" })

		const releaseDir = this.fs.path.resolve(baseDir, release.x, release.version)
		const db = new FileSystem({ cwd: releaseDir })
		if (!versions.includes(release.version)) {
			throw new Error(`Version ${release.version} not found in ${baseDir}`)
		}

		yield new Alert(`Processing NOTES.md`)
		const notes = await db.load("NOTES.md")
		if (!notes) {
			throw new Error(`NOTES.md not found in ${releaseDir}`)
		}
		const { tasks } = ReleaseProtocol.parse(notes)
		let missing = 0
		for (const task of tasks) {
			if (!task.label || !task.link || !task.text) {
				yield new Alert({ text: `Missing data in NOTE.md for task: ${JSON.stringify(task)}`, variant: "error" })
				++missing
			}
		}
		if (missing) {
			throw new Error(`Missing ${missing} tasks in NOTES.md`)
		}
		yield new Alert(`Found ${tasks.length} tasks`)

		// @todo add the parallel processing of all the tasks:
		// - follow .git consistency and block the git operation until the previous process operation from main branch is complete
		// @todo review and think about the architecture of the yield process inside
		// the processTask that utilizes ui.console for output.
		const promises = []
		for (let idx = 0; idx < tasks.length; ++idx) {
			const task = tasks[idx]
			const promise = this.processTask(task, { release, onData: (chunk) => onData({ task, chunk }) })
			promises.push(promise)
		}
		await Promise.all(promises)
		yield true
	}
	/**
	 * @param {Task} task
	 * @param {object} options
	 * @param {ReleaseProtocol} options.release
	 * @param {number} [options.index=0]
	 * @param {number} [options.len=0]
	 * @param {(chunk: any) => void} [options.onData]
	 * @returns {AsyncGenerator<UiOutput | boolean>}
	 */
	async * processTask(task, options) {
		const { release, onData = () => { } } = options
		const prefix = "llimo-task-"
		const taskId = task.link.split("/")[0]
		const tempDir = this.fs.path.resolve(this.options.temp, `${prefix}${release.version}.${taskId}`)
		const branch = `release/${release.version}.${taskId}`
		let result
		try {
			// Use FileSystem for git operations instead of execSync where possible, but execSync for git commands as per todo
			// But todo says use FileSystem, so wrap git commands if needed, but here execSync is fine as per original
			result = await this.exec("git", ["checkout", "-b", branch], { onData })
			result = await this.exec("git", ["worktree", "add", tempDir, branch], { onData })
			let attempts = 0
			while (attempts < this.options.attempts) {
				attempts++
				const taskMd = this.fs.path.resolve(this.options.release, task.link)
				result = await this.exec("llimo", ["chat", taskMd, "--new", "--yes", "--attempts", String(this.options.attempts)], { cwd: tempDir, onData })
				try {
					result = await this.exec("npm", ["run", "test:all"], { cwd: tempDir, onData })
					const taskFiles = this.fs.path.resolve(tempDir, "releases", taskId)
					if (await this.fs.exists(taskFiles)) {
						result = await this.exec("cp", ["-r", `${taskFiles}/*`, this.fs.path.resolve(this.options.release, taskId)], { onData })
					}
					result = await this.exec("git", ["add", "."], { cwd: tempDir, onData })
					result = await this.exec("git", ["commit", "-m", `Complete ${taskId}`], { onData })
					result = await this.exec("git", ["checkout", "main"], { onData })
					result = await this.exec("git", ["merge", branch], { onData })
					await this.fs.save(this.fs.path.resolve(this.options.release, `${taskId}/pass.txt`), "pnpm test:all passed")
					return { status: "complete", attempts }
				} catch {
					await this.fs.save(this.fs.path.resolve(tempDir, `${taskId}/fail-${attempts}.txt`), "Failed")
				}
			}
			await this.fs.save(this.fs.path.resolve(this.options.release, `${taskId}/fail.txt`), `Failed after ${this.options.attempts} attempts`)
			return { status: "fail", attempts: this.options.attempts }
		} catch (err) {

		} finally {
			result = await this.exec("git", ["worktree", "remove", tempDir])
		}
	}
	/**
	 * Execute bash command in cwd.
	 * @param {string} command
	 * @param {string[]} [args=[]]
	 * @param {object} [options]
	 * @param {string} [options.cwd=this.fs.cwd]
	 * @param {(chunk: any) => void} [options.onData]
	 */
	async exec(command, args = [], options = {}) {
		const {
			cwd = this.fs.cwd,
			onData = () => { },
		} = options
		return new Promise((resolve, reject) => {
			if (this.options.dry) {
				onData(`${command} ${args.join(" ")} # cwd=${cwd}`)
				resolve(0)
				return
			}
			const child = spawn(command, args, { cwd, stdio: "inherit" })
			child.on("message", (msg) => onData(msg))
			child.on("close", (code) => code === 0 ? resolve(code) : reject(new Error(`${command} ${args.join(" ")} ! failed`)))
			child.on("error", reject)
		})
	}

	/**
	 * @param {object} [input]
	 * @param {string[]} [input.argv=[]]
	 * @param {Partial<Chat>} [input.chat]
	 * @returns {ReleaseCommand}
	 */
	static create(input = {}) {
		const {
			argv = [],
			chat = new Chat()
		} = input
		const options = parseArgv(argv, ReleaseOptions)
		return new ReleaseCommand({ options, chat })
	}
}
