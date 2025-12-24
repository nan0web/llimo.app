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
import { BOLD, GREEN, ITALIC, RED, RESET, YELLOW } from "../cli/ANSI.js"
import FileSystem from "../utils/FileSystem.js"
import Markdown from "../utils/Markdown.js"
import Ui from "../cli/Ui.js"
import ModelInfo from './ModelInfo.js'
import ChatOptions from '../Chat/Options.js'

/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {Ui} ui User interface instance, used for input (stdin) stream only.
 * @returns {Promise<{input: string, inputFile: string | null}>}
 */
export async function readInput(argv, fs, ui) {
	let input = ""
	let inputFile = null

	if (!ui.stdin.isTTY) {
		// piped stdin
		for await (const chunk of ui.stdin) input += chunk
	} else if (argv.length > 0) {
		inputFile = fs.path.resolve(argv[0])
		try {
			input = await fs.load(inputFile)
		} catch (/** @type {any} */err) {
			throw new Error(`Error reading input file: ${err.message}`)
		}
	} else {
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

	const currentFile = fs.path.resolve(root, "current")
	let id

	if (await fs.exists(currentFile)) id = await fs.load(currentFile) || undefined

	/** @type {Chat} */
	const chat = new ChatClass({ id, root, cwd: fs.cwd })
	await chat.init()

	if (id === chat.id && !isNew) {
		if (await chat.load()) {
			ui.console.info(`+ loaded ${ui.formats.count(chat.messages.length)} messages from existing chat ${chat.id}`)
		} else {
			ui.console.info(`+ ${chat.id} empty chat loaded`)
		}
	} else {
		if (!isNew) {
			ui.console.info(`- no chat history found`)
		}
		ui.console.info(`${GREEN}+ ${chat.id} new chat created${RESET}`)
		await chat.clear()

		/** @type {{ role: "system", content: string }} */
		const system = { role: "system", content: await generateSystemPrompt() }

		const systemFiles = ["system.md", "agent.md"]
		for (const file of systemFiles) {
			if (await fs.exists(file)) {
				const content = await fs.load(file) || ""

				ui.console.info(`${GREEN}+ ${file}${RESET} loaded ${ui.formats.weight("b", Buffer.byteLength(content))}`)
				system.content += "\n\n" + content
			}
		}

		if (system.content) {
			ui.console.info(`  system instructions ${BOLD}${ui.formats.weight("b", Buffer.byteLength(system.content))}`)
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
 * @param {Chat} chat Chat instance (used for paths)
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @param {number} [step=1]
 * @returns {Promise<void>}
 */
export async function copyInputToChat(inputFile, input, chat, ui, step = 1) {
	if (!inputFile) return
	const file = chat.db.path.basename(inputFile)
	const full = chat.path("input")
	await chat.save("input", input, step)
	ui.console.debug(`> preparing ${file} (${inputFile})`)
	ui.console.success(`+ ${file} (${full})`)
}

/**
 * Pack the input into the LLM prompt, store it and return statistics.
 *
 * Enhanced to check file modification times and only append new blocks.
 * Updated per @todo: split input (from me.md) into blocks by ---, trim them,
 * filter out blocks that already appear in previous user messages' content,
 * then pack the new blocks. Log all user blocks to inputs.jsonl and injected files to files.jsonl.
 *
 * @param {Function} packMarkdown function that returns `{text, injected}`
 * @param {string} input
 * @param {Chat} chat Chat instance (used for `savePrompt`)
 * @param {Ui} ui User interface instance
 * @returns {Promise<{ packedPrompt: string, injected: string[], promptPath: string, stats: Stats }>}
 */
export async function packPrompt(packMarkdown, input, chat, ui) {
	const fs = new FileSystem({ cwd: chat.cwd })
	const existingPromptPath = fs.path.resolve(chat.dir, "prompt.md")

	// Collect previous user message blocks by splitting their content by --- and trimming
	const previousBlocksSet = new Set(
		chat.messages
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

	const { text: packedPrompt, injected } = await packMarkdown({ input: inputText })
	await chat.save("prompt", packedPrompt)

	const prompt = await chat.load("prompt.md") ?? ""
	const all = chat.messages.map(m => JSON.stringify(m)).join("\n\n")
	const totalSize = prompt.length + all.length
	const totalTokens = await chat.calcTokens(prompt + all)
	ui.console.info(`Prompt size: ${ITALIC}${ui.formats.weight("b", prompt.length)}${RESET} — ${ui.formats.count(injected.length)} file(s).`)
	injected.forEach(file => ui.console.debug(`+ ${file}`))
	const cost = await chat.cost()
	ui.console.info(`Messages size: ${BOLD}${ui.formats.weight("b", totalSize)}${RESET} ~ ${ui.formats.weight("T", totalTokens)} ${ui.formats.money(cost)}`)

	// Log all user blocks (including new ones) to inputs.jsonl
	const allUserBlocks = input.split(/---/).map(s => s.trim()).filter(block => block.length > 0)
	await chat.save('inputs', allUserBlocks)

	// Log injected files to files.jsonl
	await chat.save('files', injected)

	return { packedPrompt, injected, promptPath: existingPromptPath }
}

/**
 * Stream the AI response.
 *
 * The function **does not** `await` the stream – the caller decides when
 * to iterate over it.
 *
 * @param {AI} ai
 * @param {ModelInfo} model
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
 * @typedef {Object} TestOutputCounts
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
 * @typedef {{ logs: TestOutputLogs, counts: TestOutputCounts, types: Set<number>, guess: TestOutputCounts }} TestOutput
 *
 * @param {string} stdout
 * @param {string} stderr
 * @returns {TestOutput}
 */
export function parseOutput(stdout, stderr) {
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
	const guess = {
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
	const types = new Set()
	const out = stdout.split("\n")
	const err = stderr.split("\n")
	const all = [...out, ...err]

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
		const str = all[i].trim()
		if (str.startsWith("ok ")) {
			++guess.pass
			++guess.tests
		} else if (str.startsWith("not ok ")) {
			++guess.fail
			++guess.tests
		}
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
						types.add(no)
						logs[field].push({ i, str, no })
						++counts[field]
						break
					}
				}
			}
		}
	}

	// Round duration to three decimal places for consistency
	counts.duration = Math.round(counts.duration * 1e3) / 1e3

	return { logs, counts, types, guess }
}

/**
 * Decodes the answer and return the next prompt
 * @param {Object} param0
 * @param {Ui} param0.ui
 * @param {Chat} param0.chat
 * @param {ChatOptions} param0.options
 * @param {string[]} [param0.logs=[]]
 * @returns {Promise<{ answer: string, shouldContinue: boolean, logs: string[], prompt: string }>}
 */
export async function decodeAnswer({ ui, chat, options, logs = [] }) {
	const answer = chat.messages.slice().pop()
	if ("assistant" !== answer?.role) {
		throw new Error(`Recent message is not an assistant's but "${answer?.role}"`)
	}
	/** @type {string} */
	const fullResponse = String(answer.content)

	const parsed = await Markdown.parse(fullResponse)

	logs.push("#### llimo-unpack")
	logs.push("```bash")

	if (!options.isYes) {
		// Dry‑run unpack to show what would be written
		const stream = unpackAnswer(parsed, true)
		for await (const str of stream) {
			logs.push(str)
			ui.console.info(str)
		}

		// Ask user whether to apply
		const answerUser = await ui.askYesNo("Unpack current package? (Y)es, No, ., <message>: ")
		if (answerUser === "no") {
			logs.push("```")
			return { answer: "no", shouldContinue: false, logs, prompt: logs.join("\n") }
		} else if (answerUser === ".") {
			// @todo should read the current input file for the updated information and use it as next prompt
			logs.push("```")
			return { answer: ".", shouldContinue: true, logs, prompt: logs.join("\n") }
		} else if (answerUser !== "yes") {
			// @todo should use answerUser as next prompt
			logs.push("```")
			return { answer: answerUser, shouldContinue: true, logs, prompt: logs.join("\n") }
		}
	}

	// Actual unpack
	const stream = unpackAnswer(parsed)
	for await (const str of stream) {
		ui.console.info(str)
		logs.push(str)
	}
	logs.push("```")
	const prompt = logs.join("\n")
	await chat.db.save("prompt.md", prompt)
	return { answer: "", shouldContinue: true, logs, prompt }
}

/**
 * @param {Object} param0
 * @param {Ui} param0.ui
 * @param {Chat} param0.chat
 * @param {Function} param0.runCommand
 * @param {number} [param0.step=1]
 * @returns {Promise<import('../cli/runCommand.js').runCommandResult & { parsed: TestOutput }>}
 */
export async function runTests({ ui, chat, runCommand, step = 1 }) {
	// Run `pnpm test:all` with live output
	ui.console.info("! Running tests...")
	const onDataLive = (d) => ui.write(d)
	ui.console.debug("pnpm test:all")
	const result = await runCommand("pnpm", ["test:all"], { onData: onDataLive })
	result.parsed = parseOutput(result.testStdout ?? "", result.testStderr ?? "")

	// Save per‑step test output
	if (step) {
		const testOutput = `${result.testStdout}\n${result.testStderr}`
		await chat.db.save(`test-step${step}.txt`, testOutput)
	}
	return result
}

/**
 * Decode the answer markdown, unpack if confirmed, run tests, parse results,
 * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
 * tests, if they are.
 *
 * @param {import("../cli/Ui.js").default} ui User interface instance
 * @param {Chat} chat Chat instance (used for paths)
 * @param {import('../cli/runCommand.js').runCommandFn} runCommand Function to execute shell commands
 * @param {ChatOptions} options Always yes to user prompts
 * @param {number} [step] Optional step number for per-step files
 * @returns {Promise<{testsCode: boolean, shouldContinue: boolean, test: TestOutput}>}
 */
export async function decodeAnswerAndRunTests(ui, chat, runCommand, options, step = 1) {
	const logs = []
	await decodeAnswer({ ui, chat, options, logs })
	const { stdout: testStdout, stderr: testStderr, exitCode } = await runTests({ ui, chat, runCommand, step })

	// Append test output to log
	logs.push("#### pnpm test:all")
	logs.push("```stdeerr")
	logs.push(testStderr)
	logs.push("```")
	logs.push("```stdout")
	logs.push(testStdout)
	logs.push("```")
	await chat.db.append("prompt.md", logs.join("\n"))

	// Parse test results
	const parsed = parseOutput(testStdout, testStderr)
	const { fail, cancelled, pass, todo, skip, types } = parsed.counts

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

	if (!options.isYes) {
		let continuing = false
		if (fail > 0 || cancelled > 0 || types > 0) {
			const ans = await ui.askYesNo("Do you want to continue fixing fail tests? (Y)es, No, ., <message> % ")
			if (ans !== "yes") {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: ans === "yes" ? true : false, shouldContinue: false, test: parsed }
			}
			continuing = true
		}
		if (shouldContinue && todo > 0) {
			const ans = await ui.askYesNo("Do you want to continue with todo tests fixing? (Y)es, No, ., <message> % ")
			if (ans !== "yes" && !continuing) {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: false, shouldContinue: false, test: parsed }
			}
			continuing = true
		}
		if (shouldContinue && skip > 0) {
			const ans = await ui.askYesNo("Do you want to continue with skipped tests fixing? (Y)es, No, ., <message> % ")
			if (ans !== "yes" && !continuing) {
				shouldContinue = false
				if (ans !== "no" && ans !== ".") {
					chat.add({ role: "user", content: ans })
				}
				return { testsCode: false, shouldContinue: false, test: parsed }
			}
			continuing = true
		}
		if (shouldContinue && fail === 0 && cancelled === 0 && types === 0 && todo === 0 && skip === 0) {
			ui.console.success("All tests passed.")
			return { testsCode: true, shouldContinue: false, test: parsed }
		}
	}

	const testFailed = fail > 0 || cancelled > 0 || types > 0
	let testsCode = !testFailed

	if (0 === exitCode) {
		shouldContinue = false
		testsCode = true
	}

	if (!testFailed) {
		ui.console.info("All tests passed, no typed mistakes.")
	}

	return { testsCode, shouldContinue, test: parsed }
}
