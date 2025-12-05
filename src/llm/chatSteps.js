/**
 * Isolated helper functions for {@link bin/llimo-chat.js}.
 *
 * They do **not** depend on any global state, making them easy to unit-test.
 *
 * @module utils/chatSteps
 */
import { Stats } from 'node:fs'

import Chat from "./Chat.js"
import AI from "./AI.js"
import { generateSystemPrompt } from "./system.js"
import { unpackAnswer } from "./unpack.js"
import { BOLD, GREEN, ITALIC, RESET, RED, YELLOW } from "../cli/ANSI.js"
import FileSystem from "../utils/FileSystem.js"
import MarkdownProtocol from "../utils/Markdown.js"
import Ui from "../cli/Ui.js"

/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {Ui} ui User interface instance
 * @param {NodeJS.ReadStream} [stdin] Input stream
 * @returns {Promise<{input: string, inputFile: string | null}>}
 */
export async function readInput(argv, fs, ui, stdin = process.stdin) {
	let input = ""
	let inputFile = null

	if (!stdin.isTTY) {
		// piped stdin
		for await (const chunk of stdin) input += chunk
	} else if (argv.length > 0) {
		inputFile = fs.path.resolve(argv[0])
		try {
			input = await fs.readFile(inputFile, "utf-8")
		} catch (/** @type {any} */err) {
			ui.console.error(`Error reading input file: ${err.message}`)
			throw err
		}
	} else {
		ui.console.error("No input provided.")
		throw new Error("No input provided.")
	}
	return { input, inputFile }
}

/**
 * Initialise a {@link Chat} instance (or re‑use an existing one) and
 * persist the current chat ID.
 *
 * @param {object} input either the Chat class itself (positional form) or an options object (named form).
 * @param {typeof Chat} [input.ChatClass] required only when using the positional form.
 * @param {FileSystem} [input.fs] required only when using the positional form.
 * @param {string} [input.root] chat root directory
 * @param {boolean} [input.isNew] additional options when using the positional form.
 * @param {Ui} input.ui User interface instance
 * @returns {Promise<{chat: Chat, currentFile: string}>}
 */
export async function initialiseChat(input) {
	const {
		ChatClass = Chat,
		fs = new FileSystem(),
		isNew = false,
		root = "chat",
		ui,
	} = input

	const format = new Intl.NumberFormat("en-US").format
	const currentFile = fs.path.resolve(root, "current")
	let id

	if (await fs.exists(currentFile)) id = await fs.load(currentFile) || undefined

	/** @type {Chat} */
	const chat = new ChatClass({ id, root, cwd: fs.cwd })
	await chat.init()

	if (id === chat.id && !isNew) {
		if (await chat.load()) {
			ui.console.info(`+ loaded ${format(chat.messages.length)} messages from existing chat ${chat.id}`)
		} else {
			ui.console.info(`+ ${chat.id} empty chat loaded`)
		}
	} else {
		if (!isNew) {
			ui.console.info(`- no chat history found`)
		}
		ui.console.info(`${GREEN}+ ${chat.id} new chat created${RESET}`)
		await chat.clear()

		const system = { role: "system", content: "" }
		system.content += await generateSystemPrompt()

		const systemFiles = ["system.md", "agent.md"]
		for (const file of systemFiles) {
			if (await fs.exists(file)) {
				const content = await fs.load(file) || ""
				ui.console.info(`${GREEN}+ ${file}${RESET} loaded ${ITALIC}${format(Buffer.byteLength(content))} bytes${RESET}`)
				system.content += "\n\n" + content
			}
		}

		if (system.content) {
			ui.console.info(`  system instructions ${ITALIC}${BOLD}${format(Buffer.byteLength(system.content))} bytes${RESET}`)
		}

		chat.add(system)
	}
	await fs.save(currentFile, chat.id)

	return { chat, currentFile }
}

/**
 * Copy the original input file into the chat directory for later reference.
 *
 * @param {string|null} inputFile absolute path of the source file (or null)
 * @param {string} input raw text (used when `inputFile` is null)
 * @param {Chat} chat
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @returns {Promise<void>}
 */
export async function copyInputToChat(inputFile, input, chat, ui) {
	if (!inputFile) return
	const file = chat.db.path.basename(inputFile)
	const full = chat.db.path.resolve(file)
	await chat.db.save(file, input)
	ui.console.info(`> preparing ${file} (${inputFile})`)
	ui.console.info(`+ ${file} (${full})`)
	ui.console.info(`  copied to chat session`)
}

/**
 * Pack the input into the LLM prompt, store it and return statistics.
 *
 * @param {Function} packMarkdown function that returns `{text, injected}`
 * @param {string} input
 * @param {Chat} chat Chat instance (used for `savePrompt`)
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @returns {Promise<{ packedPrompt: string, injected: string[], promptPath: string, stats: Stats }>}
 */
export async function packPrompt(packMarkdown, input, chat, ui) {
	const { text: packedPrompt, injected } = await packMarkdown({ input })
	const promptPath = await chat.savePrompt(packedPrompt)

	const stats = await chat.fs.stat(promptPath)
	const format = new Intl.NumberFormat("en-US").format
	ui.console.info(
		`Prompt size: ${format(stats.size)} bytes — ${injected.length} file(s).`
	)

	return { packedPrompt, injected, promptPath, stats }
}

/**
 * Stream the AI response.
 *
 * The function **does not** `await` the stream – the caller decides when
 * to iterate over it.
 *
 * @param {AI} ai
 * @param {string} model
 * @param {Chat} chat
 * @param {object} options Stream options
 * @returns {{stream: AsyncIterable<any>, result: any}}
 */
export function startStreaming(ai, model, chat, options) {
	const result = ai.streamText(model, chat.messages, options)
	const stream = result.textStream ?? result
	return { stream, result }
}

/**
 * @typedef {Object} TestOutputLogEntry
 * @property {number} i
 * @property {number} no
 * @property {string} str
 *
 * @typedef {Object} TestOutputLogs
 * @property {TestOutputLogEntry[]} fail
 * @property {TestOutputLogEntry[]} cancelled
 * @property {TestOutputLogEntry[]} pass
 * @property {TestOutputLogEntry[]} tests
 * @property {TestOutputLogEntry[]} suites
 * @property {TestOutputLogEntry[]} skip
 * @property {TestOutputLogEntry[]} todo
 * @property {TestOutputLogEntry[]} duration
 * @property {TestOutputLogEntry[]} types
 *
 * @typedef {Object} TestOutput
 * @property {number} fail
 * @property {number} cancelled
 * @property {number} pass
 * @property {number} tests
 * @property {number} suites
 * @property {number} skip
 * @property {number} todo
 * @property {number} duration
 * @property {number} types
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {object} context - Returns context.logs for more detailed info.
 * @returns {TestOutput}
 */
export function parseOutput(stdout, stderr, context = {}) {
	const out = stdout.split("\n")
	const err = stderr.split("\n")
	const all = [...out, ...err]
	const logs = {
		fail: [],
		cancelled: [],
		pass: [],
		tests: [],
		suites: [],
		skip: [],
		todo: [],
		duration: [],
		types: [],
	}
	const counts = {
		fail: 0,
		cancelled: 0,
		pass: 0,
		tests: 0,
		suites: 0,
		skip: 0,
		todo: 0,
		duration: 0,
		types: 0,
	}

	/** Unique TS error codes for `types` */
	const typeCodes = new Set()

	const parser = {
		fail: ["# fail ", "ℹ fail "],
		cancelled: ["# cancelled ", "ℹ cancelled "],
		pass: ["# pass ", "ℹ pass "],
		tests: ["# tests ", "ℹ tests "],
		suites: ["# suites ", "ℹ suites "],
		skip: ["# skipped ", "ℹ skipped "],
		todo: ["# todo ", "ℹ todo "],
		duration: ["# duration_ms ", "ℹ duration_ms "],
		types: [/^.+: error TS(\d+):.+$/],
	}

	for (let i = 0; i < all.length; i++) {
		const str = all[i].trimEnd()
		for (const [field, vars] of Object.entries(parser)) {
			for (const v of vars) {
				if ("string" === typeof v) {
					if (str.startsWith(v)) {
						const no = Number(str.slice(v.length).trim())
						logs[field].push({ i, str, no })
						counts[field] += no
						break
					}
				} else if (v instanceof RegExp) {
					const matches = str.match(v)
					if (matches) {
						const no = Number(matches[1])
						typeCodes.add(no)
						logs[field].push({ i, str, no })
						++counts[field]
						break
					}
				}
			}
		}
	}

	// Round duration to three decimal places for consistency
	counts.duration = Math.round(counts.duration * 1000) / 1000

	context.logs = logs
	context.types = typeCodes

	return counts
}

/**
 * Decode the answer markdown, unpack if confirmed, run tests, parse results, and ask user for continuation.
 *
 * @typedef {(cmd: string, args: string[], opts: object) => Promise<{ stdout: string, stderr: string }>} runCommandFn
 *
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @param {Chat} chat Chat instance (used for paths)
 * @param {runCommandFn} runCommand Function to execute shell commands
 * @param {boolean} [isYes] Always yes to user prompts
 * @param {number} [step] Optional step number for per-step files
 * @returns {Promise<{testsCode: boolean | string, shouldContinue: boolean}>}
 */
export async function decodeAnswerAndRunTests(ui, chat, runCommand, isYes = false, step) {
	const logs = []
	const answer = chat.messages.slice().pop()
	if ("assistant" !== answer?.role) {
		throw new Error(`Recent message is not an assistant's but "${answer?.role}"`)
	}
	/** @type {string} */
	const fullResponse = String(answer.content)

	const parsed = await MarkdownProtocol.parse(fullResponse)

	logs.push("#### llimo-unpack")
	logs.push("```bash")

	if (!isYes) {
		// Dry‑run unpack to show what would be written
		const stream = unpackAnswer(parsed, true)
		for await (const str of stream) {
			logs.push(str)
			ui.console.info(str)
		}

		// Ask user whether to apply
		const answerUser = await ui.askYesNo("Unpack current package? (Y)es, No, ., <message>: ")
		if (answerUser === "no") {
			return { testsCode: "no", shouldContinue: false }
		} else if (answerUser === ".") {
			return { testsCode: ".", shouldContinue: false }
		} else if (answerUser !== "yes") {
			chat.add({ role: "user", content: answerUser })
			return { testsCode: answerUser, shouldContinue: true }
		}
	}

	// Actual unpack
	const stream = unpackAnswer(parsed)
	for await (const str of stream) {
		ui.console.info(str)
		logs.push(str)
	}
	logs.push("```")
	await chat.db.save("prompt.md", logs.join("\n"))

	// Run `pnpm test:all` with live output
	ui.console.info("! Running tests...")
	const onDataLive = (d) => ui.write(d)
	ui.console.debug("pnpm test:all")
	const { stdout: testStdout, stderr: testStderr } = await runCommand("pnpm", ["test:all"], { onData: onDataLive })

	// Save per‑step test output
	if (step) {
		const testOutput = `${testStdout}\n${testStderr}`
		await chat.db.save(`test-step${step}.txt`, testOutput)
	}

	// Append test output to log
	logs.push("#### pnpm test:all")
	logs.push("```bash")
	logs.push(testStderr)
	logs.push(testStdout)
	logs.push("```")
	await chat.db.append("prompt.md", logs.join("\n"))

	// Parse test results
	const { fail, cancelled, pass, todo, skip, types } = parseOutput(testStdout, testStderr)

	// Build coloured summary
	let summary = "Tests: "
	summary += fail > 0 ? `${RED}${fail} fail${RESET}` : "0 fail"
	summary += " | "
	summary += cancelled > 0 ? `${YELLOW}${cancelled} cancelled${RESET}` : "0 cancelled"
	summary += " | "
	summary += pass > 0 ? `${GREEN}${pass} pass${RESET}` : "0 pass"
	summary += " | "
	summary += todo > 0 ? `${YELLOW}${todo} todo${RESET}` : "0 todo"
	summary += " | "
	summary += skip > 0 ? `${YELLOW}${skip} skip${RESET}` : "0 skip"
	summary += " | "
	summary += types > 0 ? `${YELLOW}${types} types${RESET}` : "0 types"

	ui.console.info(summary)

	let shouldContinue = true

	if (!isYes) {
		if (fail > 0 || cancelled > 0 || types > 0) {
			const ans = await ui.askYesNo("Do you want to continue fixing fail tests? (Y)es, No, ., <message> % ")
			if (ans !== "yes") {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: ans === "yes" ? true : false, shouldContinue: false }
			}
		}
		if (shouldContinue && todo > 0) {
			const ans = await ui.askYesNo("Do you want to continue with todo tests fixing? (Y)es, No, ., <message> % ")
			if (ans !== "yes") {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: false, shouldContinue: false }
			}
		}
		if (shouldContinue && skip > 0) {
			const ans = await ui.askYesNo("Do you want to continue with skipped tests fixing? (Y)es, No, ., <message> % ")
			if (ans !== "yes") {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: false, shouldContinue: false }
			}
		}
		if (shouldContinue && fail === 0 && cancelled === 0 && types === 0 && todo === 0 && skip === 0) {
			ui.console.success("All tests passed.")
			return { testsCode: true, shouldContinue: false }
		}
	}

	const testFailed = fail > 0 || cancelled > 0 || types > 0
	const testsCode = !testFailed

	if (!testFailed) {
		ui.console.info("All tests passed, no typed mistakes.")
	}

	return { testsCode, shouldContinue }
}
