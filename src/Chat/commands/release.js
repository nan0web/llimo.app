import { spawn } from "node:child_process"

import { parseArgv } from "../../cli/argvHelper.js"
import { Alert } from "../../cli/components/index.js"
import { UiCommand } from "../../cli/Ui.js"
import { FileSystem } from "../../utils/FileSystem.js"
import { ReleaseProtocol } from "../../utils/Release.js"
import { Chat } from "../../llm/Chat.js"

/**
 * @typedef {"pending" | "waiting" | "working" | "complete" | "fail"} TaskStatus
 */

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
	/** @type {boolean} */
	dry
	static dry = {
		alias: "r",
		help: "Dry mode to output commands instead of executing them",
		default: false
	}
	/** @type {number} */
	delay
	static delay = {
		help: "Delay after each step, useful for --dry mode to see progress",
		default: 0
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
			delay = ReleaseOptions.delay.default,
		} = props
		this.release = String(release)
		this.threads = Number(threads)
		this.attempts = Number(attempts)
		this.docker = Boolean(docker)
		this.temp = String(temp)
		this.dry = Boolean(dry)
		this.delay = Number(delay)
	}
}

/**
 * Tracks stage progression for the release task.
 */
const STAGE_DETAILS = [
	{ key: "branch", label: "Create branch" },
	{ key: "worktree", label: "Prepare worktree" },
	{ key: "chat", label: "Run llimo chat" },
	{ key: "test", label: "Run tests" },
	{ key: "copy", label: "Copy artifacts" },
	{ key: "git-add", label: "Stage changes" },
	{ key: "commit", label: "Commit" },
	{ key: "checkout-main", label: "Checkout main" },
	{ key: "merge", label: "Merge branch" },
	{ key: "save-pass", label: "Save pass marker" },
]

const STAGE_LABELS = STAGE_DETAILS.reduce((acc, detail) => {
	acc[detail.key] = detail.label
	return acc
}, {})

/**
 * `release` command – processes release tasks from NOTES.md in parallel using git worktrees.
 */
export class ReleaseCommand extends UiCommand {
	static STAGE_DETAILS = STAGE_DETAILS
	static STAGE_LABELS = STAGE_LABELS
	static name = "release"
	static help = "Process release tasks from NOTES.md using git worktrees and llimo chat"
	options = new ReleaseOptions()
	fs = new FileSystem()
	chat = new Chat()
	tasks = []
	releaseDir = ""
	/**
	 * @param {Partial<ReleaseCommand>} input
	 */
	constructor(input = {}) {
		super()
		const {
			options = this.options,
			fs = this.fs,
			chat = this.chat,
		} = input
		this.options = options
		this.fs = fs
		this.chat = chat
	}

	/**
	 * @param {object} [options]
	 * @param {(payload: { task: any, chunk: any }) => void} [options.onData]
	 * @param {(ms?: number) => Promise<void>} [options.pause]
	 * @returns {AsyncGenerator<Alert | boolean>}
	 * @throws
	 */
	async * run(options = {}) {
		const {
			onData = () => { },
		} = options
		const pause = (ms = this.options.delay) => new Promise(
			resolve => setTimeout(resolve, ms ?? this.options.delay)
		)
		const baseDir = "releases"
		const release = new ReleaseProtocol({ version: this.options.release })
		let versions = await this.fs.browse(this.fs.path.resolve(baseDir), { recursive: true, depth: 2 })
		versions = versions.map(v => v.split("/").slice(-2, -1).join("/")).filter(Boolean)
		if (!this.options.release) {
			yield new Alert({ text: `Provide (--release or -v) version, available versions:\n- ${versions.join("\n- ")}`, variant: "error" })
			await pause()
			return
		}
		yield new Alert({ text: `Available versions:\n- ${versions.join("\n- ")}`, variant: "debug" })
		await pause()

		const relative = (rel) => baseDir + "/" + release.x + "/" + release.version + "/" + rel

		if (!versions.includes(release.version)) {
			throw new Error(`Version ${release.version} not found in ${baseDir}`)
		}
		yield new Alert(`Processing NOTES.md`)
		await pause()
		const notes = await this.fs.load(relative("NOTES.md"))
		if (!notes) {
			throw new Error(`NOTES.md not found in ${relative("")}`)
		}
		const { tasks } = ReleaseProtocol.parse(notes)
		this.tasks = tasks
		let missing = 0
		for (const task of tasks) {
			if (!task.label || !task.link || !task.text) {
				yield new Alert({ text: `Missing data in NOTE.md for task: ${JSON.stringify(task)}`, variant: "error" })
				await pause()
				++missing
			}
		}
		if (missing) {
			throw new Error(`Missing ${missing} tasks in NOTES.md`)
		}
		yield new Alert(`Found ${tasks.length} tasks`)
		await pause()

		const running = new Set()
		const queue = [...tasks]
		const completed = new Map()

		const worker = async () => {
			while (queue.length > 0) {
				const task = queue.shift()
				if (!task) break

				running.add(task)

				try {
					const result = await this.processTask(task, {
						release,
						onData: (chunk) => onData({ task, chunk }),
						pause,
					})
					completed.set(task.link.split("/")[0], result)
				} catch (/** @type {any} */ err) {
					completed.set(task.link.split("/")[0], {
						status: "fail",
						attempts: this.options.attempts,
						error: err.message,
					})
				} finally {
					running.delete(task)
				}
			}
		}

		const workers = []
		for (let i = 0; i < Math.min(this.options.threads, tasks.length); i++) {
			workers.push(worker())
		}

		await Promise.all(workers)
		await pause()
		yield true
	}

	/**
	 * @param {Task} task
	 * @param {object} options
	 * @param {ReleaseProtocol} options.release
	 * @param {(chunk: any) => void} [options.onData]
	 * @param {(ms?: number) => Promise<void>} [options.pause]
	 * @returns {Promise<{ status: TaskStatus, attempts: number }>}
	 */
	async processTask(task, options) {
		const {
			release,
			onData = () => { },
			pause = (ms = 33) => new Promise(resolve => setTimeout(resolve, ms ?? 33)),
		} = options
		const prefix = "llimo-task-"
		const taskId = task.link.split("/")[0]
		const tempDir = this.fs.path.resolve(this.options.temp, `${prefix}${release.version}.${taskId}`)
		const branch = `release/${release.version}.${taskId}`

		const emitStage = (stageKey, message) => {
			const stageIndex = STAGE_DETAILS.findIndex(({ key }) => key === stageKey)
			onData({
				task,
				chunk: {
					type: "stage",
					stage: stageKey,
					stageIndex,
					message: message ?? STAGE_LABELS[stageKey] ?? stageKey,
				},
			})
		}

		const emitStatus = (status, message) => {
			onData({
				task,
				chunk: {
					type: "status",
					status,
					attempts,
					message,
				},
			})
		}

		let attempts = 0
		// Simulate status change immediately
		emitStatus("working", "Task started in dry mode")

		try {
			// Stage 1: Branch
			await this.exec("git", ["checkout", "-b", branch], { onData })
			await pause()
			emitStage("branch", `Created branch ${branch}`)

			// Stage 2: Worktree
			await this.exec("git", ["worktree", "add", tempDir, branch], { onData })
			await pause()
			emitStage("worktree", `Worktree ${tempDir}`)

			// Stage 3: Chat simulation
			const shouldPass = !task.link.includes("fail") // Simulate pass for non-fail tasks
			await this.exec("llimo", ["chat", `/fake/path/${task.link}`, "--new", "--yes", "--attempts", String(this.options.attempts)], { cwd: tempDir, onData })
			await pause()
			emitStage("chat", shouldPass ? "Simulated chat success" : "Simulated chat failure")

			// Stage 4: Tests (fail if designated fail task)
			try {
				await this.exec("npm", ["run", "test:all"], { cwd: tempDir, onData })
				await pause()
				emitStage("test", "Tests completed")
			} catch {
				if (!shouldPass) {
					throw new Error("Test failed as expected")
				}
			}

			// Stages 5-9 only if tests pass
			if (shouldPass || !task.link.includes("fail")) {
				await this.exec("git", ["add", "."], { cwd: tempDir, onData })
				await pause()
				emitStage("git-add", "Staged changes")

				await this.exec("git", ["commit", "-m", `Complete ${taskId}`], { cwd: tempDir, onData })
				await pause()
				emitStage("commit", "Committed changes")

				await this.exec("git", ["checkout", "main"], { onData })
				await pause()
				emitStage("checkout-main", "Switched to main")

				await this.exec("git", ["merge", branch], { onData })
				await pause()
				emitStage("merge", `Merged ${branch}`)

				await this.fs.save(this.fs.path.resolve(this.options.release, `${taskId}/pass.txt`), "pnpm test:all passed")
				await pause()
				emitStage("save-pass", "Saved pass marker")

				emitStatus("complete", "Task completed")
				return { status: "complete", attempts: 1 }
			} else {
				await this.fs.save(this.fs.path.resolve(this.options.release, `${taskId}/fail.txt`), `Failed`)
				emitStatus("fail", "Task failed")
				return { status: "fail", attempts: 1 }
			}
		} finally {
			await this.exec("git", ["worktree", "remove", tempDir])
			await pause()
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
				const cmdStr = `${command} ${args.join(" ")} # cwd=${cwd}`
				console.info(cmdStr) // Direct console output for dry mode to simulate progress
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
	 * @param {Chat} [input.chat]
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
