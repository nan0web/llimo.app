/**
 * Isolated helper functions for {@link bin/llimo-chat.js}.
 *
 * They do **not** depend on any global state, making them easy to unit-test.
 *
 * @module utils/chatSteps
 */
import { Chat } from "./Chat.js"
import { AI } from "./AI.js"
import { generateSystemPrompt } from "./system.js"
import { unpackAnswer } from "./unpack.js"
import { BOLD, GREEN, ITALIC, MAGENTA, RED, RESET, YELLOW } from "../cli/ANSI.js"
import { FileSystem } from "../utils/FileSystem.js"
import { MarkdownProtocol } from "../utils/Markdown.js"
import { Ui, UiStyle } from "../cli/Ui.js"
import { ModelInfo } from './ModelInfo.js'
import ChatOptions from '../Chat/Options.js'
import { Suite } from '../cli/testing/node.js'
import { testingProgress, testingStatus } from '../cli/testing/progress.js'

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
			ui.console.info(`@ system instructions ${BOLD}${ui.formats.weight("b", Buffer.byteLength(system.content))}`)
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
 * @param {import("../cli/Ui.js").Ui} ui User interface instance
 * @param {number} [step=1]
 * @returns {Promise<void>}
 */
export async function copyInputToChat(inputFile, input, chat, ui, step = 1) {
	if (!inputFile) return
	const file = chat.db.path.basename(inputFile)
	const full = chat.path("input")
	let rel = chat.fs.path.relative(chat.fs.cwd, full)
	if (rel.startsWith("..")) rel = full
	await chat.save("input", input, step)
	ui.console.debug(`> preparing ${file} (${inputFile})`)
	ui.console.success(`+ ${file} (${rel})`)
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
 * @returns {Promise<{ packedPrompt: string, injected: string[] }>}
 */
export async function packPrompt(packMarkdown, input, chat) {
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

	// Log all user blocks (including new ones) to inputs.jsonl
	const allUserBlocks = input.split(/---/).map(s => s.trim()).filter(block => block.length > 0)
	await chat.save('inputs', allUserBlocks)

	// Log injected files to files.jsonl
	await chat.save('files', injected)

	return { packedPrompt, injected }
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

	const parsed = await MarkdownProtocol.parse(fullResponse)

	logs.push("#### llimo-unpack")
	logs.push("```bash")

	if (!options.isYes) {
		// Dry‑run unpack to show what would be written
		const stream = unpackAnswer(parsed, true)
		for await (const str of stream) {
			logs.push(String(str))
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
	for await (const uiElement of stream) {
		ui.console.info(uiElement)
		logs.push(String(uiElement))
	}
	logs.push("```")
	const prompt = logs.join("\n")
	await chat.db.save("prompt.md", prompt)
	return { answer: "", shouldContinue: true, logs, prompt }
}

/**
 *
 * @param {import('../cli/testing/node.js').TestInfo[]} tests
 * @param {Ui} ui
 * @returns {any[][]}
 */
export function renderTests(tests, ui = new Ui()) {
	const stderr = []
	tests.forEach(t => {
		stderr.push([`${t.file}:${t.position?.[0]}:${t.position?.[1]}`, ui.createStyle({ paddingLeft: 2 })])
		stderr.push([t.text, ui.createStyle({ paddingLeft: 4 })])
		if (t.doc.error) stderr.push([t.doc?.error, ui.createStyle({ paddingLeft: 6 })])
		if (t.doc.stack) stderr.push([t.doc?.stack, ui.createStyle({ paddingLeft: 8 })])
		stderr.push([""])
	})
	return stderr
}

/**
 *
 * @param {Object} input
 * @param {Ui} input.ui
 * @param {"fail" | "skip" | "todo"} [input.type]
 * @param {import('../cli/testing/node.js').TestInfo[]} [input.tests=[]]
 * @param {string[]} [input.content=[]]
 * @returns {Promise<boolean>}
 */
export async function printAnswer(input) {
	let {
		ui,
		type = "fail",
		tests = [],
		content = [],
	} = input
	const types = {
		fail: ["fail", "cancelled", "types"],
	}

	let ans = await ui.askYesNo(`\n${MAGENTA}? Do you want to continue fixing ${type} tests? (y)es, (n)o, (s)how, ., <message> % `)

	const arr = tests.filter(t => (types[type] ?? [type]).includes(t.type))
	ui.console.info("")

	const stderr = renderTests(arr)
	if (["show", "s"].includes(ans.toLowerCase())) {
		stderr.forEach(args => ui.console.info(...args))
		ans = await ui.askYesNo(`${MAGENTA}? Do you want to continue fixing ${type} tests? (y)es, (n)o, ., <message> % `)
	}
	if ("no" === ans) {
		return false
	}
	if ("yes" === ans) {
		// just continue
	}
	else if ("." === ans) {
		// @todo read input file such as me.md and add as content.push(fileContent)
	}
	else {
		content.push(ans)
	}
	stderr.map(args => args.filter(a => !(a instanceof UiStyle)).join(" ")).forEach(a => content.push(a))
	arr.forEach(t => content.push(`- [](${t.file})`))
	return true
}

/**
 * Decode the answer markdown, unpack if confirmed, run tests, parse results,
 * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
 * tests, if they are.
 *
 * @param {Object} input
 * @param {import("../cli/Ui.js").Ui} input.ui User interface instance
 * @param {FileSystem} [input.fs]
 * @param {Chat} input.chat Chat instance (used for paths)
 * @param {import('../cli/runCommand.js').runCommandFn} input.runCommand Function to execute shell commands
 * @param {ChatOptions} input.options Always yes to user prompts
 * @param {number} [input.step] Optional step number for per-step files
 * @returns {Promise<{pass?: boolean, shouldContinue: boolean, test?: import('../cli/testing/node.js').TapParseResult}>}
 */
export async function decodeAnswerAndRunTests(input) {
	const {
		ui, fs = new FileSystem(), chat, runCommand, options, step = 1
	} = input
	const logs = []
	try {
		const answered = await decodeAnswer({ ui, chat, options, logs })
		if (!answered.shouldContinue) {
			return { shouldContinue: false }
		}
	} catch (err) {
		if (!options.isFix) {
			throw err
		}
	}

	// @todo run sequence of tests:
	// 1. context tests (attached or generated tests)
	// 2. run `pnpm test:all`

	const { pass, shouldContinue, test } = await runTests({
		ui,
		fs,
		chat,
		runCommand,
		logs,
		options,
		step,
	})

	return { pass, shouldContinue, test }
}

/**
 * @typedef {Object} runTestsResult
 * @property {boolean} pass
 * @property {boolean} shouldContinue
 * @property {import("../cli/testing/node.js").SuiteParseResult} [test]
 *
 * @param {Object} input
 * @param {Ui} input.ui
 * @param {FileSystem} input.fs
 * @param {Chat} input.chat
 * @param {import("../cli/runCommand.js").runCommandFn} input.runCommand
 * @param {number} [input.step=1]
 * @param {string[]} [input.logs=[]]
 * @param {object} [input.options={}]
 * @returns {Promise<runTestsResult>}
 */
export async function runTests(input) {
	const {
		ui,
		fs,
		chat,
		runCommand = () => { },
		logs = [],
		options = {},
		step = 1,
	} = input
	const now = Date.now()
	const output = []
	const testing = testingProgress({ ui, fs, output, rows: 12, prefix: "  " })
	const onData = chunk => output.push(...String(chunk).split("\n"))
	// const { stdout: testStdout, stderr: testStderr, exitCode } = await runTests({ ui, chat, runCommand, step, onData })

	ui.console.info("@ Running tests")
	ui.console.debug("% pnpm test:all")
	const result = await runCommand("pnpm", ["test:all"], { onData })
	clearInterval(testing)
	if (!result) {
		return { pass: false, shouldContinue: false }
	}
	const suite = new Suite({ rows: [...result.stdout.split("\n"), ...result.stderr.split("\n")], fs })
	const parsed = suite.parse()

	if (step) {
		await chat.save("test.txt", `${result.stdout}\n${result.stderr}`, step)
	}

	// Append test output to log
	logs.push("#### pnpm test:all")
	logs.push("```stdeerr")
	logs.push(result.stderr)
	logs.push("```")
	logs.push("```stdout")
	logs.push(result.stdout)
	logs.push("```")
	await chat.db.append("prompt.md", logs.join("\n"))

	// Parse test results
	const fail = parsed.counts.get("fail") ?? 0
	const cancelled = parsed.counts.get("cancelled") ?? 0
	const types = parsed.counts.get("types") ?? 0
	const todo = parsed.counts.get("todo") ?? 0
	const skip = parsed.counts.get("skip") ?? 0
	// const { fail, cancelled, pass, todo, skip, types } = parsed.counts
	ui.overwriteLine("  " + testingStatus(parsed, ui.formats.timer((Date.now() - now) / 1e3)))
	ui.console.info("")
	// ui.console.info()

	let shouldContinue = true

	if (!options.isYes) {
		let continuing = false
		const content = []
		if (fail > 0 || cancelled > 0 || types > 0) {
			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "fail" })
			if (!continuing) {
				return { pass: false, shouldContinue: false, test: parsed }
			}
		}
		if (shouldContinue && todo > 0) {
			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "todo" })
			if (!continuing) {
				return { pass: false, shouldContinue: false, test: parsed }
			}
		}
		if (shouldContinue && skip > 0) {
			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "skip" })
			if (!continuing) {
				return { pass: false, shouldContinue: false, test: parsed }
			}
		}
		chat.add({ role: "user", content: content.join("\n") })
		if (shouldContinue && fail === 0 && cancelled === 0 && types === 0 && todo === 0 && skip === 0) {
			ui.console.success("All tests passed.")
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
		ui.console.info("All tests passed, no typed mistakes.")
	}

	return { pass, shouldContinue, test: parsed }
}
