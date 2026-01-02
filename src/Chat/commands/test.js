import { parseArgv } from "../../cli/argvHelper.js"
import { runCommand } from "../../cli/runCommand.js"
import Chat from "../../llm/Chat.js"
import { InfoCommand } from "./info.js"
import FileSystem from "../../utils/FileSystem.js"
import { Progress, Alert } from "../../cli/components/index.js"
import { Suite } from "../../cli/testing/node.js"
import { testingProgress } from "../../cli/testing/progress.js"

/**
 * @param {string} str
 * @returns {boolean}
 */
function DebuggerFilter(str) {
	return !str.startsWith("Error: Debugger") &&
				!str.startsWith("Error: Waiting for the debugger")
}

/**
 * Options for the `test` command.
 */
export class TestOptions {
	/** @type {string} */
	id
	static id = {
		help: "Chat ID (optional), if not provided current will be used",
		default: ""
	}
	/** @type {string} */
	testDir
	static testDir = {
		alias: "test-dir",
		default: ""
	}
	constructor(input = {}) {
		const {
			id = TestOptions.id.default,
			testDir = TestOptions.testDir.default,
		} = input
		this.id = String(id)
		this.testDir = String(testDir)
	}
}

/**
 * `test` command – shows a table with per‑message statistics and a total line.
 *
 * Columns:
 *   - **Role** – system / user / assistant / tool
 *   - **Files** – number of attached files (detected via markdown checklist)
 *   - **Bytes** – raw byte size of the message content
 *   - **Tokens** – estimated token count (≈ 1 token per 4 bytes)
 *
 * After printing the table, the command yields `false` so the CLI code knows it can
 * continue with the normal chat loop.
 */
export class TestCommand extends InfoCommand {
	static name = "test"
	static help = "Show information of the chat before tests run"
	options = new TestOptions()
	async * run() {
		await this.chat.init()
		if (!this.chat.id) {
			throw new Error("Provide Chat ID")
		}
		let testDir = this.options.testDir
		const fs = new FileSystem()
		const originalChatDir = this.chat.dir
		if (!testDir) {
			// Create temporary directory
			testDir = await fs.mkdtemp(`llimo-test-`)
		} else {
			yield Alert.info(`Using provided test directory: ${testDir}`)
		}
		const tempFs = new FileSystem({ cwd: testDir })
		const tempChatDir = tempFs.path.resolve(testDir, "chat", this.chat.id)
		await tempFs.mkdir(tempChatDir, { recursive: true })

		const warn = this.createAlerter("warn")
		yield warn("Creating temporary test environment...")

		// Step 1: Copy files from current chat dir
		yield warn(`  Copying chat from ${originalChatDir} to ${tempChatDir}`)
		const chatEntries = await fs.browse(originalChatDir, { recursive: true })
		const chatFiles = chatEntries.filter(e => !e.endsWith("/"))
		let copiedChat = 0
		for (const relFile of chatFiles) {
			const src = fs.path.resolve(originalChatDir, relFile)
			const dest = fs.path.resolve(tempChatDir, relFile)
			const content = await fs.load(src)
			await tempFs.save(dest, content)
			copiedChat++
			const value = 100 * (copiedChat / chatFiles.length)
			yield new Progress({ value, text: `${copiedChat}/${chatFiles.length} chat files copied`, prefix: "  " })
		}
		yield Alert.info("")

		// Step 2: Copy current directory (project) to temp
		const projectDir = process.cwd()
		yield warn(`  Copying project from ${projectDir} to ${testDir}`)
		const projectEntries = await fs.browse(".", { recursive: true, ignore: [".git/**", "node_modules/**"] })
		const projectFiles = projectEntries.filter(e => !e.endsWith("/"))
		let copiedProject = 0
		for (const relFile of projectFiles) {
			if (relFile.endsWith("/")) continue
			const src = fs.path.resolve(projectDir, relFile)
			const dest = fs.path.resolve(testDir, relFile)
			try {
				const content = await fs.readFile(src)
				await tempFs.save(dest, content)
				copiedProject++
				const value = 100 * (copiedProject / projectFiles.length)
				yield new Progress({ value, text: `${copiedProject}/${projectFiles.length} project files copied`, prefix: "  " })
			} catch (err) {
				// Skip if cannot read (e.g., symlinks, permissions)
			}
		}
		yield Alert.info("")

		// Step 3: Run the pnpm or npm install
		yield warn(`  Installing dependencies in ${testDir}...`)
		let installCmd = "pnpm"
		let installArgs = ["install"]
		let installCwd = testDir
		let output = []
		const onData = (d) =>
			String(d).split("\n").filter(Boolean).filter(DebuggerFilter).forEach(l => output.push(l))
		const installing = this.ui.createProgress((input) => {
			this.ui.overwriteLine(`  ${input.elapsed.toFixed(2)}s ${output.slice(-1).join("")}`)
		})
		const { exitCode: installExitCode } = await runCommand(
			installCmd, installArgs, { cwd: installCwd, onData }
		)
		if (installExitCode !== 0) {
			yield warn(`  Install warning: pnpm failed (${installExitCode}), trying npm...`)
			installCmd = "npm"
			installArgs = ["install"]
			await runCommand(installCmd, installArgs, { cwd: installCwd, onData })
		}
		clearInterval(installing)
		yield Alert.info("")
		yield warn(`+ Install complete: success`)

		// Step 4: Run tests before chatting
		const testing = testingProgress({ ui: this.ui, fs: this.fs, output, rows: 3 })
		yield warn(`  Running baseline tests in ${testDir}...`)
		const { exitCode: testExitCode, stdout: testOut, stderr: testErr } = await runCommand(
			"pnpm", ["test:all"], { cwd: testDir, onData }
		)
		clearInterval(testing)
		yield Alert.info("")
		const rows = [...testOut.split("\n"), ...testErr.split("\n")]
		const suite = new Suite({ rows, fs: this.fs })
		const parsed = suite.parse()
		const ok = testExitCode === 0
		const { cancelled, fail, types } = Object.fromEntries(Array.from(parsed.counts))
		const failed = fail + cancelled + types
		yield warn(`${ok ? "+" : "-"} Baseline tests complete: ${ok ? "all passed" : `${failed} failed`}`)
		if (failed > 0) {
			if (fail + cancelled > 0) {
				yield Alert.error(`There are ${fail} failed test(s) and ${cancelled} cancelled tests`)
			}
			if (types > 0) {
				yield Alert.error(`! There are ${types} failed types`)
			}
			yield Alert.error(`! It might be an issue`)
		}

		// Reset chat variables to temp
		this.chat = new Chat({
			dir: tempChatDir,
			cwd: testDir,
			fs: new FileSystem({ cwd: testDir }),
		})
		yield warn(`+ Test environment ready at ${testDir} (chat at ${tempChatDir})`)

		// Header
		yield warn(`• Simulating`)
		yield warn(`  Chat ID: ${this.chat.id}`)
		yield warn(`  Chat Dir: ${this.chat.dir}`)
		yield warn(`  Test Dir: ${testDir}`)

		// Load chat history and simulate steps using pre-recorded responses
		await this.chat.load()

		// @todo save the chat/*/steps.jsonl during chat and load here
		const rawDirs = await tempFs.browse(tempChatDir, { recursive: true })
		const stepDirs = rawDirs.filter(path => path.startsWith("steps/") && path.includes("/model.json"))
			.map(path => path.split("/").slice(0, -1).join("/"))
			.sort()

		yield warn(`  Found ${stepDirs.length} steps to simulate`)

		// Final info table
		yield await this.info()

		// Signal end of simulation
		yield true
	}
	/**
	 * @param {object} [input]
	 * @param {string[]} [input.argv=[]]
	 * @param {Partial<Chat>} [input.chat]
	 * @returns {TestCommand}
	 */
	static create(input = {}) {
		const {
			argv = [],
			chat = new Chat()
		} = input
		const options = parseArgv(argv, TestOptions)
		return new TestCommand({ options, chat })
	}
}
