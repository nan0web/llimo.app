import process from "node:process"
import yaml from "yaml"
import micromatch from "micromatch"

import { Git, FileSystem } from "../utils/index.js"
import { RESET, MAGENTA, YELLOW, ITALIC, RED, BOLD, GREEN, DIM } from "./ANSI.js"
import { Ui } from "./Ui.js"
import { runCommand } from "./runCommand.js"
import { selectAndShowModel, showModel } from "./selectModel.js"
import {
	AI, Chat, packMarkdown,
	initialiseChat, packPrompt,
	handleTestMode, sendAndStream,
	readInput,
	ModelInfo, Architecture, Pricing,
	Usage,
	printAnswer,
} from "../llm/index.js"
import { loadModels, ChatOptions } from "../Chat/index.js"
import chatCommands from "../Chat/commands/index.js"
import { runningProgress, testingStatus } from "./testing/progress.js"
import { Suite } from "./testing/node.js"
import { MarkdownProtocol } from "../utils/Markdown.js"
import { UiOutput } from "./UiOutput.js"
import commands from "../llm/commands/index.js"
import { Alert, Progress } from "./components/index.js"
import { FileError, FileSize } from "../FileProtocol.js"
import { parseArgv } from "./argvHelper.js"

const DEFAULT_MODEL = "gpt-oss-120b"
const DEFAULT_PROVIDER = "cerebras"

/** @typedef {(input: import("./Ui.js").ProgressFnInput, printed?: number, frame?: string) => void} AfterProgressFn */

/**
 * @typedef {Object} SendAndStreamOptions
 * @property {string} answer
 * @property {string} reason
 * @property {Usage} usage
 * @property {any[]} unknowns
 * @property {any} [error]
 */

export class ChatCLiApp {
	/** @type {FileSystem} */
	fs
	/** @type {Git} */
	git
	/** @type {Ui} */
	ui
	/** @type {AI} */
	ai
	/** @type {ChatOptions} */
	options
	/** @type {Chat} */
	chat
	/** @type {string} */
	input
	/** @type {string} */
	inputFile
	/** @type {(value: number | bigint) => string} */
	#format
	/** @type {(value: number | bigint) => string} */
	#valuta
	/** @type {Array<{step: number, model: ModelInfo, prompt: string}>} */
	#steps = []
	/** @param {Partial<ChatCLiApp>} props */
	constructor(props) {
		const {
			fs,
			git,
			ui,
			ai,
			options,
			chat = new Chat({}),
			input = "",
			inputFile = "",
		} = props
		this.fs = fs ?? new FileSystem()
		this.git = git ?? new Git()
		this.ui = ui ?? new Ui()
		this.ai = ai ?? new AI()
		this.options = new ChatOptions(options)
		this.chat = chat
		this.input = String(input)
		this.inputFile = inputFile
		this.#format = new Intl.NumberFormat("en-US").format
		this.#valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format
	}
	/**
	 * @param {string[]} argv
	 * @returns {Promise<boolean>}
	 */
	async init(argv) {
		const { isNew, isYes } = this.options
		const { chat } = await initialiseChat({ ui: this.ui, ChatClass: Chat, fs: this.fs, isNew })
		this.chat = chat
		const sysOpts = parseArgv(this.chat.system.vars ?? {}, ChatOptions, this.options)
		if (sysOpts.argv.length) sysOpts.argv = []
		this.options = parseArgv(argv, ChatOptions, sysOpts)
		let shouldContinue = await this.runCommandFirst()
		if (!shouldContinue) {
			return false
		}

		await this.initAI(isYes)
		return true
	}
	/**
	 * Run the command before the chat, such as info, test, list.
	 * Returns `false` if no need to continue with chat, and `true` if continue.
	 * @returns {Promise<boolean>}
	 */
	async runCommandFirst() {
		let shouldContinue = true
		const found = Object.entries(chatCommands).find(([name]) => name === this.options.argv[0])
		if (found) {
			this.options.argv.shift()
			// process the specific command before chatting
			const Command = found[1]
			const cmd = Command.create({ argv: this.options.argv ?? [], chat: this.chat })
			for await (const chunk of cmd.run()) {
				if (typeof chunk === "boolean") {
					shouldContinue = chunk
					this.ui.console.debug(`[shouldContinue = ${shouldContinue ? 'yes' : 'no'}]`)
					break
				}
				else {
					this.ui.render(chunk)
				}
			}
		}

		return shouldContinue
	}

	async initAI(isYes = false) {
		/** @type {AI} */
		if (!this.ai) {
			this.ai = new AI()
		}
		const models = await loadModels({ ui: this.ui })
		this.ai.setModels(models)
		// Fixed pre-select: prioritize chat.config.model if available from loaded chat
		const savedModel = await this.chat.load("model.json") ?? {}
		const modelStr = this.options.model ||
			(this.chat.config?.model || savedModel.id) || // Load from saved model
			process.env.LLIMO_MODEL ||
			DEFAULT_MODEL
		const providerStr = this.options.provider || this.chat.config?.provider || process.env.LLIMO_PROVIDER || DEFAULT_PROVIDER
		const onSelect = (model) => {
			this.chat.config.model = model.id
			this.chat.config.provider = model.provider
		}
		if (isYes) {
			const model = this.ai.getProviderModel(modelStr, providerStr)
			if (!model) {
				throw new Error(`Model not found for ${modelStr}@${providerStr}`)
			}
			this.ai.selectedModel = model
			this.chat.save("model.json", model)
			return
		}
		const preLoaded = await this.chat.load("model.json")
		if (preLoaded) {
			this.ai.selectedModel = preLoaded
			onSelect(preLoaded)
		} else {
			this.ai.selectedModel = await selectAndShowModel(this.ai, this.ui, modelStr, providerStr, onSelect)
		}
	}
	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	async readInput() {
		// 1. read input (stdin / file) - use cleanArgv to avoid flags
		try {
			const { input, inputFile } = await readInput(this.options.argv[0] ?? this.options.inputFile, this.fs, this.ui)
			this.input = input
			this.inputFile = inputFile ?? ""
		} catch (err) {
			const { input, inputFile } = await readInput(["me.md"], this.fs, this.ui)
			this.input = input
			this.inputFile = inputFile ?? ""
		}
		if (undefined === this.input) {
			return false
		}

		await this.chat.save("input.md", this.input)
		const testChatDir = this.options.testDir || this.chat.dir
		if (this.options.isTest) {
			const dummyModel = new ModelInfo({
				id: "test-model",
				pricing: new Pricing({ prompt: 0, completion: 0 }),
				architecture: new Architecture({ modality: "text" })
			})
			await handleTestMode({
				ai: this.ai, ui: this.ui, cwd: testChatDir, input: this.input, chat: this.chat,
				model: dummyModel, fps: 33
			})
			return false
		}
		return true
	}
	/**
	 * Returns True to continue chat and False to stop the chat.
	 * @param {string} prompt
	 * @param {ModelInfo} model
	 * @param {{ content: string, injected: FileSize[] }} packed
	 * @param {number} [step=1]
	 * @returns {Promise<boolean>}
	 */
	async prepare(prompt, model, packed, step = 1) {
		await this.chat.save({
			input: this.input,
			prompt,
			model: this.ai.selectedModel ?? undefined,
			step,
			messages: []
		})
		this.ui.console.info(`\n@ Step ${step}. ${new Date().toLocaleString()}`)

		const promptFiles = 0
		const all = this.chat.messages.map(m => JSON.stringify(m)).join("\n\n")
		const totalSize = prompt.length + all.length
		const totalTokens = await this.chat.calcTokens(prompt + all)

		packed.injected.forEach(el => this.ui.console.debug(`+ ${el.file} ${this.ui.formats.weight("b", el.size)}`))
		this.ui.console.debug('Total size:', this.ui.formats.weight("b", totalSize))

		const found = this.ai.ensureModel(model, totalTokens)
		if (found && found.id !== model.id) {
			this.ui.console.info(`@ Model changed due to ${this.ai.strategy.constructor.name}`)
			showModel(found, this.ui)
			model = found
		}
		const cost = await this.chat.cost()
		const left = model.context_length - totalTokens
		const str = [
			"  Prompt: ",
			ITALIC, this.ui.formats.weight("b", prompt.length), RESET,
			promptFiles ? ` - ${this.ui.formats.weight("f", promptFiles)}` : "",
			" | Chat: ",
			ITALIC, this.ui.formats.weight("b", totalSize), RESET,
			" ~ ", ITALIC, this.ui.formats.weight("T", totalTokens), RESET,
			" ~ ", this.ui.formats.money(model.pricing.calc(new Usage({ inputTokens: totalTokens }))),
			" | Left: ", this.ui.formats.used(left, model.context_length),
			" | ", this.ui.formats.money(cost, 2)
		].filter(Boolean).join("")
		this.ui.console.info(str)
		this.ui.console.success("  prompt.md (" + this.chat.rel("prompt.md", step) + ")")

		// Show batch discount information
		const discount = model.pricing?.getBatchDiscount() ?? []
		if (discount[0] || discount[1]) {
			this.ui.console.info(`\n! batch processing has ${discount[0]}% read | ${discount[1]} write discount compared to streaming\n`)
		}
		if (!this.options.isYes) {
			const ans = await this.ui.askYesNo(`\n${MAGENTA}? Send prompt to LLiMo? (Y)es, No: ${RESET}`)
			this.ui.console.info("")
			if ("yes" !== ans) return false
		}
		return true
	}
	/**
	 *
	 * @param {import("../FileProtocol").ParsedFile} parsed
	 * @param {boolean} [isDry=false] If true yields messages without saving files
	 * @returns {AsyncGenerator<boolean | string | UiOutput>}
	 */
	async * unpackAnswer(parsed, isDry = false) {
		const { correct = [], failed = [], files = new Map() } = parsed

		yield new Alert(`@ Extracting files ${isDry ? `${YELLOW}(dry mode, no real saving)` : ""}`)

		for (const file of correct) {
			const {
				filename = "",
				label = "",
				content = "",
				encoding = "utf-8",
			} = file
			const text = String(content)

			/* Command entries – those whose filename starts with “@”. */
			if (filename.startsWith("@")) {
				const commandName = filename.slice(1)

				// Emit a tiny hint that a command is being executed – the test only
				// checks that the raw “@something” token appears somewhere.
				yield new Alert(`${YELLOW}@ ${filename}${RESET}`)

				const Cmd = commands.get(commandName)
				if (Cmd) {
					const cmd = new Cmd({ cwd: process.cwd(), file, parsed })
					const output = []
					const running = runningProgress({
						ui: this.ui, output, rows: 9, prefix: `${filename} `, after: (input, printed, frame) => {
							this.ui.cursorUp(printed)
							this.ui.console.info(frame)
						}
					})
					for await (const line of cmd.run()) {
						output.push(new Alert(String(line)))
					}
					clearInterval(running)
				} else {
					// Unknown command – list available ones.
					yield new Alert(`${RED}! Unknown command: ${filename}${RESET}`)
					yield new Alert("! Available commands:")
					for (const [name, Cls] of commands.entries()) {
						yield new Alert(` - ${name} - ${Cls.help}`)
					}
				}

				continue
			}

			if (text.trim() === "") {
				// Empty file – warn but do not write.
				yield `${YELLOW}- ${filename} - ${BOLD}empty content${RESET} - to remove file use command @rm`
				continue
			}

			// Save the file unless we are in dry‑run mode.
			if (!isDry) {
				await this.fs.save(filename, text, encoding)
			}

			// Build a concise status line (the original implementation printed this via console.info).
			const suffix =
				(label && !filename.includes(label)) || label !== files.get(filename)
					? ` — ${MAGENTA}${label}${RESET}`
					: ""
			const size = Buffer.byteLength(text)
			const indicator = isDry ? `${YELLOW}•` : `${GREEN}+`
			yield new Alert(`${indicator}${RESET} ${filename} (${ITALIC}${this.ui.formats.weight("b", size)}${RESET})${suffix}`)
		}

		/* Group and report parse errors from the “failed” list. */
		/** @type {Map<string, FileError[]>} */
		const grouped = new Map()
		for (const err of failed) {
			const key = String(err.error)
			const arr = grouped.get(key) ?? []
			arr.push(err)
			grouped.set(key, arr)
		}

		for (const [msg, list] of grouped.entries()) {
			yield new Alert({ text: `${RED}! Error: ${msg}${RESET}`, variant: "warn" })
			const maxLine = list.reduce(
				(m, e) => Math.max(m, String(e.line).length),
				0
			)
			for (const e of list) {
				yield new Alert({ text: `  ${RED}# ${String(e.line).padStart(maxLine, " ")} > ${e.content}${RESET}`, variant: "warn" })
			}
		}
	}

	/**
	 * @param {number} step
	 */
	async decodeAnswer(step) {
		const content = []
		const answer = this.chat.messages.slice().pop()
		if ("assistant" !== answer?.role) {
			throw new Error(`Recent message is not an assistant's but "${answer?.role}"`)
		}
		/** @type {string} */
		const fullResponse = String(answer.content)

		const parsed = await MarkdownProtocol.parse(fullResponse)

		content.push("#### llimo-unpack")
		content.push("```bash")

		if (!this.options.isYes) {
			// Dry‑run unpack to show what would be written
			const stream = this.unpackAnswer(parsed, true)
			for await (const str of stream) {
				if (str instanceof UiOutput) {
					this.ui.console.info(str)
				}
			}

			// Ask user whether to apply
			const answerUser = await this.ui.askYesNo("Unpack current package? (Y)es, No, ., <message>: ")
			if (answerUser === "no") {
				return { answer: "no", shouldContinue: false, prompt: "User rejected the answer" }
			} else if (answerUser === ".") {
				return { answer: ".", shouldContinue: true, prompt: "User rejected the answer and provides own prompt" }
			} else if (answerUser !== "yes") {
				// @todo should use answerUser as next prompt
				return { answer: answerUser, shouldContinue: true, prompt: answerUser }
			}
		}

		// Actual unpack
		const stream = this.unpackAnswer(parsed)
		for await (const uiElement of stream) {
			if (uiElement instanceof UiOutput) {
				this.ui.console.info(uiElement)
			}
			content.push(String(uiElement))
		}
		content.push("```")
		const prompt = content.join("\n")
		await this.chat.db.save("prompt.md", prompt)
		return { answer: "", shouldContinue: true, prompt }
	}
	/**
	 * Decodes the answer and return the next prompt
	 * @param {import("../llm/chatLoop.js").sendAndStreamOptions} sent
	 * @param {number} [step=1]
	 * @returns {Promise<{ answer: string, shouldContinue: boolean, prompt: string }>}
	 */
	async unpack(sent, step = 1) {
		this.chat.add({ role: "assistant", content: sent.answer })
		await this.chat.save()
		this.ui.console.info("")
		if (sent.reason) {
			let reasonFile = this.chat.path("reason.md", step)
			let rel = this.chat.fs.path.relative(this.chat.fs.cwd, reasonFile)
			if (rel.startsWith("..")) rel = reasonFile
			this.ui.console.info(`+ reason (${rel})`)
		}
		let answerFile = this.chat.path("answer.md", step)
		let rel = this.chat.fs.path.relative(this.chat.fs.cwd, answerFile)
		if (rel.startsWith("..")) rel = answerFile
		this.ui.console.info(`+ answer (${rel})`)
		return await this.decodeAnswer(step)
	}
	/**
	 *
	 * @param {string} prompt
	 * @param {ModelInfo} model
	 * @param {number} [step=1]
	 * @returns {Promise<import("../llm/chatLoop.js").sendAndStreamOptions>}
	 */
	async send(prompt, model, step = 1) {
		// 6. send messages and see the stream progress
		const streamed = await sendAndStream({
			ai: this.ai, chat: this.chat, ui: this.ui, step, prompt,
			format: this.#format, valuta: this.#valuta, model
		})
		// Save step info including model
		this.#steps.push({ step, model, prompt })
		await this.chat.save("steps.jsonl", this.#steps)
		return streamed
	}
	/**
	 *
	 * @param {number} step
	 * @returns {Promise<{ pass: boolean, shouldContinue: boolean, test?: import("./testing/node.js").SuiteParseResult }>}
	 */
	async runTests(step) {
		const content = []
		const now = Date.now()
		const output = []
		const testing = runningProgress({
			ui: this.ui, output, rows: 12, prefix: "  ", startTime: Date.now(), fps: 33,
			after: (input) => {
				const suite = new Suite({ rows: output, fs: this.fs })
				const parsed = suite.parse()
				const str = testingStatus(parsed, this.ui.formats.timer(input.elapsed * 1e3))
				this.ui.overwriteLine(`  ${str}`)
			}
		})

		/** @param {any} chunk */
		const onData = chunk => output.push(...String(chunk).split("\n"))
		// const { stdout: testStdout, stderr: testStderr, exitCode } = await runTests({ ui, chat, runCommand, step, onData })

		this.ui.console.info("@ Running tests")
		this.ui.console.debug("% pnpm test:all")
		const result = await runCommand("pnpm", ["test:all"], { onData })
		clearInterval(testing)
		if (!result) {
			return { pass: false, shouldContinue: false }
		}
		const suite = new Suite({ rows: [...result.stdout.split("\n"), ...result.stderr.split("\n")], fs: this.fs })
		const parsed = suite.parse()

		await this.chat.saveTests(parsed, result.stderr, result.stdout, step)

		// Parse test results
		const fail = parsed.counts.get("fail") ?? 0
		const cancelled = parsed.counts.get("cancelled") ?? 0
		const types = parsed.counts.get("types") ?? 0
		const todo = parsed.counts.get("todo") ?? 0
		const skip = parsed.counts.get("skip") ?? 0
		// const { fail, cancelled, pass, todo, skip, types } = parsed.counts
		this.ui.overwriteLine("  " + testingStatus(parsed, this.ui.formats.timer(Date.now() - now)))
		this.ui.console.info("")
		// ui.console.info()

		let shouldContinue = true

		if (!this.options.isYes) {
			let continuing = false
			if (fail > 0 || cancelled > 0 || types > 0) {
				continuing = await printAnswer({ tests: parsed.tests, ui: this.ui, content, type: "fail" })
				if (!continuing) {
					return { pass: false, shouldContinue: false, test: parsed }
				}
			}
			if (shouldContinue && todo > 0) {
				continuing = await printAnswer({ tests: parsed.tests, ui: this.ui, content, type: "todo" })
				if (!continuing) {
					return { pass: false, shouldContinue: false, test: parsed }
				}
			}
			if (shouldContinue && skip > 0) {
				continuing = await printAnswer({ tests: parsed.tests, ui: this.ui, content, type: "skip" })
				if (!continuing) {
					return { pass: false, shouldContinue: false, test: parsed }
				}
			}
			this.chat.add({ role: "user", content: content.join("\n") })
			if (shouldContinue && fail === 0 && cancelled === 0 && types === 0 && todo === 0 && skip === 0) {
				this.ui.console.success("All tests passed.")
				return { pass: true, shouldContinue: false, test: parsed }
			}
		}

		const testFailed = fail > 0 || cancelled > 0 || types > 0
		let pass = !testFailed

		if (0 === result.exitCode) {
			shouldContinue = false
			pass = true
		}

		if (!testFailed) {
			this.ui.console.info("All tests passed, no typed mistakes.")
		}

		return { pass, shouldContinue, test: parsed }
	}
	/**
	 *
	 * @param {number} [step=1]
	 * @returns {Promise<{ shouldContinue: boolean, test?: import("./testing/node.js").SuiteParseResult }>}
	 */
	async test(step = 1) {
		const { test, pass } = await this.runTests(step)
		if (true === pass) {
			this.ui.console.success("@ Task is complete")
			await this.git.commitAll("Task is complete")
			return { shouldContinue: false, test }
		} else {
			let consecutiveErrors = 0
			const MAX_ERRORS = 9
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				this.ui.console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				// @todo write fail log
				return { shouldContinue: false, test }
			}
		}
		return { shouldContinue: true, test }
	}
	/**
	 * @param {import("./testing/node.js").SuiteParseResult} tested
	 * @param {number} [step=1]
	 * @returns {Promise<string>} Prompt
	 */
	async next(tested, step = 1) {
		const rows = [
			"## Test results:",
			Array.from(tested.counts.entries()).map(([k, v]) => `- ${k}: ${v}`).join("\n"),
			"",
		]
		const fillRows = (type) => {
			const arr = tested.tests.filter(t => t.type === type)
			if (!arr.length) return
			rows.push(`### ${type} tests:`)
			arr.forEach(t => {
				rows.push(`#### ${t.file}:${t.position?.[0]}:${t.position?.[1]}`)
				rows.push("```")
				const text = t.doc ? yaml.stringify(t.doc) : t.text
				rows.push(`${text.split("\n").filter(Boolean).join("\n")}`)
				rows.push("```")
			})
			rows.push("")
		}
		fillRows("fail")
		fillRows("cancelled")
		fillRows("todo")
		// Pack the next input (original or test feedback)
		const packed = await packPrompt(packMarkdown, rows.join("\n"), this.chat)
		await this.chat.save("prompt.md", packed.packedPrompt, step)
		return packed.packedPrompt
	}
	/**
	 * Packs files into a single markdown string based on a checklist.
	 * @param {Object} options
	 * @param {string} [options.input] - The markdown string containing the checklist.
	 * @param {string} [options.cwd] - The current working directory to resolve files from.
	 * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
	 * @param {string[]} [options.ignore=[]] An array of directory names to ignore.
	 * @returns {AsyncGenerator<string | FileSize | UiOutput>} - The generated markdown string with packed files.
	 */
	async * packMarkdown(options = {}) {
		const {
			input = "", onRead = undefined, ignore = [".git", "node_modules"]
		} = options
		const lines = input.split("\n")
		const added = new Set()

		let i = 0
		for (const line of lines) {
			yield new Progress({ value: i++ / lines.length, text: line })
			const extracted = MarkdownProtocol.extractPath(line)
			if (extracted) {
				const { name, path: relativePath } = extracted
				let params = name.split(";")
				const listOnly = params[0] === "@ls"
				if (listOnly) {
					params = params.slice(1)
				}
				const absPath = this.fs.path.resolve(relativePath)

				// Handle ignore patterns supplied via a leading “-” in the checklist label.
				params.forEach(word => {
					if (word.startsWith("-")) {
						ignore.push(word.slice(1))
					}
				})

				// Handle glob patterns
				if (relativePath.includes("*")) {
					try {
						// Determine the base directory and the glob pattern.
						const parts = relativePath.split("/")
						let closestDir = "."
						let pattern = relativePath

						for (let i = 0; i < parts.length; i++) {
							if (parts[i].includes("*")) {
								closestDir = parts.slice(0, i).join("/") || "."
								pattern = parts.slice(i).join("/")
								break
							}
						}

						const entries = await this.fs.browse(closestDir, { recursive: true, onRead, ignore })

						// Keep only files matching the glob.
						const matchedFiles = entries.filter(entry =>
							micromatch.isMatch(entry, pattern, { dot: true })
						)

						matchedFiles.sort()

						for (const file of matchedFiles) {
							if (file.endsWith("/")) continue // skip directories

							const relativeFilePath = closestDir === "." ? file : `${closestDir}/${file}`
							if (added.has(relativeFilePath)) continue
							added.add(relativeFilePath)

							// Build the path relative to the original cwd (e.g. "/var/folders/_2/xxx/src/File.js").
							const filePath = this.fs.path.resolve(relativeFilePath)

							if (listOnly) {
								yield relativeFilePath
								continue
							}
							try {
								const content = await this.fs.readFile(filePath, "utf-8")
								const filename = this.fs.path.basename(file)
								const size = Buffer.byteLength(content)
								const type = this.fs.path.extname(file).slice(1) || "txt"

								// Use plain size without colour codes.
								yield new FileSize({ file: relativeFilePath, size })
								// injected.push(`${relativeFilePath} ${(this.ui.formats.weight("b", size))}`)
								yield `#### [${filename}](${relativeFilePath})`
								yield `\`\`\`${type}`
								yield content
								yield "```"
							} catch (error) {
								yield Alert.error(`${line} -> ${filePath}`)
								yield `ERROR: Could not read file ${filePath}`
							}
						}
					} catch (error) {
						yield Alert.error(line)
						yield `ERROR: Could not process pattern ${relativePath}`
					}
				} else {
					// Single file handling
					if (added.has(relativePath)) continue
					try {
						const content = await this.fs.readFile(absPath, "utf-8")
						const filename = name || this.fs.path.basename(relativePath)
						const size = Buffer.byteLength(content)
						const type = this.fs.path.extname(relativePath).slice(1) || "txt"
						yield new FileSize({ file: relativePath, size })
						yield `#### [${filename}](${relativePath})`
						yield `\`\`\`${type}`
						yield content
						yield "```"
					} catch (error) {
						yield Alert.error(line)
						yield `ERROR: Could not read file ${relativePath}`
					}
				}
			} else {
				// Preserve non‑checklist lines verbatim.
				yield line
			}
		}
	}

	/**
	 * Pack the input into the LLM prompt, store it and return statistics.
	 *
	 * Enhanced to check file modification times and only append new blocks.
	 * Updated per @todo: split input (from me.md) into blocks by ---, trim them,
	 * filter out blocks that already appear in previous user messages' content,
	 * then pack the new blocks. Log all user blocks to inputs.jsonl and injected files to files.jsonl.
	 *
	 * @param {string} input
	 * @returns {Promise<{ content: string, injected: FileSize[] }>}
	 */
	async packPrompt(input) {
		// Collect previous user message blocks by splitting their content by --- and trimming
		const previousBlocksSet = new Set(
			this.chat.messages
				.filter(m => m.role === 'user')
				.map(m => {
					if ("string" === typeof m.content) {
						return m.content.split(/---/).map(s => s.trim())
					}
					return m
				})
				.flat()
		)

		// Split input into blocks by ---, trim each block, and filter out those already in previous messages
		const newBlocks = input
			.split(/---/)
			.map(s => s.trim())
			.filter(block => block.length > 0 && !previousBlocksSet.has(block))

		// If no new blocks, do nothing or handle as needed (here, we proceed with empty input to avoid errors)
		const inputText = newBlocks.join('\n---\n')

		const text = []
		const injected = []
		// let bar = ""
		const stream = this.packMarkdown({ input: inputText })
		for await (const entry of stream) {
			if ("string" === typeof entry) {
				text.push(entry)
			}
			else if (entry instanceof UiOutput) {
				if (entry instanceof Alert) {
					if (this.ui.console[entry.variant]) {
						this.ui.console[entry.variant](String(entry))
					} else {
						this.ui.console.info(String(entry))
					}
					// this.ui.console.info(bar)
				}
				else if (entry instanceof Progress) {
					// this.ui.cursorUp(bar)
					// bar = this.ui.console.full(String(entry))
					// this.ui.console.info(bar)
				}
			}
			else if (entry instanceof FileSize) {
				injected.push(entry)
			}
		}

		const content = text.join("\n")
		await this.chat.save("prompt", content)

		// Log all user blocks (including new ones) to inputs.jsonl
		const allUserBlocks = input.split(/---/).map(s => s.trim()).filter(block => block.length > 0)
		await this.chat.save('inputs', allUserBlocks)

		// Log injected files to files.jsonl
		await this.chat.save('files', injected)

		return { content, injected }
	}

	/**
	 * Copies input data to chat db.
	 * @param {number} step
	 * @returns {Promise<void>}
	 */
	async copyInput(step) {
		if (!this.inputFile) return
		const file = this.chat.db.path.basename(this.inputFile)
		const full = this.chat.path("input")
		let rel = this.chat.rel(full)
		if (rel.startsWith("..")) rel = full
		await this.chat.save("input", this.input, step)
		this.ui.console.debug(`> preparing ${file} (${this.inputFile})`)
		this.ui.console.success(`+ ${file} (${rel})`)
	}

	/**
	 * Copies input data to chat db.
	 * @param {number} step
	 * @returns {Promise<void>}
	 */
	async packSystem(step) {
		const size = Buffer.byteLength(this.chat.system.head + this.chat.system.body)
		await this.chat.save("system", this.chat.system.head + this.chat.system.body, step)
		this.ui.console.success(`+ system.md (${this.chat.rel("system")}) - ${this.ui.formats.weight("b", size)}`)
	}

	/**
	 * Starts the chat:
	 * 1. Detect the recent step
	 * 1.1. for Test it should go from the first step
	 * 1.2. for Real it should go from the recent step
	 * 2. Prepare input (pack prompt with messages)
	 * 3. Select a model
	 * 3.1. for Test it should be selected from saved log
	 * 3.2. for Real it should use available by the algorithm
	 * @returns {Promise<{ step: number, prompt: string, model: ModelInfo, packed: { content: string, injected: FileSize[] } }>}
	 */
	async start() {
		let step = this.chat.assistantMessages.length + 1
		this.ui.console.debug(yaml.stringify(this.options))
		await this.copyInput(step)
		await this.packSystem(step)

		// 4. pack prompt – prepend system.md if present
		let packed = await this.packPrompt(this.input)

		// 5. chat loop – refactored
		const model = this.ai.selectedModel
		if (!model) {
			throw new Error("LLiMo model is not selected, provide it in env variable LLIMO_MODEL=gpt-oss-120b")
		}
		this.ui.console.info("@", this.chat.assistantMessages.length + 1, "steps loaded")
		return { step, prompt: packed.content, model, packed }
	}
	/**
	 * Run communication loop.
	 * @returns {Promise<void>}
	 */
	async loop() {
		let { step, prompt, model, packed } = await this.start()
		let fixing = this.options.isFix
		while (true) {
			if (!fixing) {
				let shouldContinue = await this.prepare(prompt, model, packed, step)
				if (!shouldContinue) break
				const sent = await this.send(prompt, model, step)
				const unpacked = await this.unpack(sent, step)
				if (!unpacked.shouldContinue) break
			}
			fixing = false
			const tested = await this.test(step)
			if (!tested.shouldContinue) break
			if (!tested.test) break
			prompt = await this.next(tested.test, step)
			++step
		}
		await this.chat.save("steps.jsonl", this.#steps)
	}

	/**
	 * Creates progress for testing commands.
	 * @param {object} param0
	 * @param {Ui} param0.ui
	 * @param {FileSystem} [param0.fs]
	 * @param {string[]} [param0.output]
	 * @param {number} [param0.rows=0]
	 * @param {string} [param0.prefix=""]
	 * @param {number} [param0.startTime]
	 * @param {number} [param0.fps=33]
	 * @returns {NodeJS.Timeout}
	 */
	testingProgress({ output = [], rows = 0, prefix = "", startTime = Date.now(), fps = 33 }) {
		return this.runningProgress({
			output, rows, prefix, startTime, fps, after: (input) => {
				const suite = new Suite({ rows: output, fs: this.fs })
				const parsed = suite.parse()
				const str = testingStatus(parsed, this.ui.formats.timer(input.elapsed * 1e3))
				this.ui.overwriteLine(`  ${str}`)
			}
		})
	}

	/**
	 * Creates progress for commands to run in a window.
	 * @param {object} param0
	 * @param {string[]} [param0.output]
	 * @param {number} [param0.rows=0] The window height
	 * @param {string} [param0.prefix=""]
	 * @param {number} [param0.startTime]
	 * @param {number} [param0.fps=33]
	 * @param {AfterProgressFn} [param0.after]
	 * @returns {NodeJS.Timeout}
	 */
	runningProgress({ output = [], rows = 0, prefix = "", startTime = Date.now(), fps = 33, after = () => { } }) {
		let printed = 0
		return this.ui.createProgress((input) => {
			if (printed) this.ui.cursorUp(printed)
			let arr = output.filter(Boolean).filter(this.noDebugger)
			if (rows > 0) arr = arr.slice(-rows)
			this.ui.console.startFrame()
			const lines = arr.map(r => this.ui.console.clear(prefix + r))
			lines.forEach(l => this.ui.console.info(`\r${DIM}${l}${RESET}`))
			if (lines.length < printed) {
				for (let i = 0; i < printed - lines.length; i++) {
					this.ui.console.info(this.ui.console.clear(""))
				}
			}
			printed = lines.length

			after(input, printed, this.ui.console.stopFrame())
		}, startTime, fps)
	}

	noDebugger(str) {
		return ![
			"Error: Waiting for the debugger to disconnect",
			"Error: Debugger attached",
		].some(s => str.includes(s))
	}

}
