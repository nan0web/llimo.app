/**
 * Isolated helper functions for {@link bin/llimo-chat.js}.
 *
 * They do **not** depend on any global state, making them easy to unit-test.
 *
 * @module utils/chatSteps
 */
import { Chat } from "./Chat.js"
import { AI } from "./AI.js"
import { generateSystemPrompt, parseSystemPrompt, mergeSystemPrompts } from "./system.js"
import { unpackAnswer } from "./unpack.js"
import { GREEN, MAGENTA, RESET } from "../cli/ANSI.js"
import { FileSystem } from "../utils/FileSystem.js"
import { MarkdownProtocol } from "../utils/Markdown.js"
import { Ui } from "../cli/Ui.js"
import { ModelInfo } from './ModelInfo.js'
import ChatOptions from '../Chat/Options.js'
import { Suite } from '../cli/testing/node.js'
import { testingProgress, testingStatus } from '../cli/testing/progress.js'
import { UiOutput } from "../cli/UiOutput.js"
import { packMarkdown } from "./pack.js"

/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[] | string} argv CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {Ui} ui User interface instance, used for input (stdin) stream only.
 * @returns {Promise<{input: string, inputFile: string | null}>}
 */
export async function readInput(argv, fs, ui) {
	let input = ""
	let inputFile = null
	const file = Array.isArray(argv) ? argv[0] : argv

	if (!ui.stdin.isTTY) {
		// piped stdin
		for await (const chunk of ui.stdin) input += chunk
	} else if (file) {
		inputFile = fs.path.resolve(file)
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

		const arr = []
		const base = await generateSystemPrompt()
		arr.push(parseSystemPrompt(base))

		const systemFiles = ["system.md", "agent.md"]
		for (const file of systemFiles) {
			if (await fs.exists(file)) {
				const content = await fs.load(file) || ""

				ui.console.info(`${GREEN}+ ${file}${RESET} loaded ${ui.formats.weight("b", Buffer.byteLength(content))}`)
				arr.push(parseSystemPrompt(content))
			}
		}
		const system = mergeSystemPrompts(arr)
		chat.system = system

		const packed = await packMarkdown({
			input: system.body,
			cwd: fs.cwd,
			ignore: system.vars.ignore ?? undefined
		})
		const content = system.head + packed.text
		await chat.save("system", content)
		chat.add({ content, role: "system" })
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
	let rel = chat.rel(full)
	if (rel.startsWith("..")) rel = full
	await chat.save("input", input, step)
	ui.console.debug(`> preparing ${file} (${inputFile})`)
	const size = Buffer.byteLength(chat.system.head + chat.system.body)
	await chat.save("system", chat.system.head + chat.system.body, step)
	ui.console.success(`+ system.md (${chat.rel("system")}) - ${ui.formats.weight("b", size)}`)
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
 * @deprecated use ChatCliApp.decodeAnswer
 * @param {Object} param0
 * @param {Ui} param0.ui
 * @param {Chat} param0.chat
 * @param {ChatOptions} param0.options
 * @returns {Promise<{ answer: string, shouldContinue: boolean, prompt: string }>}
 */
export async function decodeAnswer({ ui, chat, options }) {
	const content = []
	const answer = chat.messages.slice().pop()
	if ("assistant" !== answer?.role) {
		throw new Error(`Recent message is not an assistant's but "${answer?.role}"`)
	}
	/** @type {string} */
	const fullResponse = String(answer.content)

	const parsed = await MarkdownProtocol.parse(fullResponse)

	content.push("#### llimo-unpack")
	content.push("```bash")

	if (!options.isYes) {
		// Dry‑run unpack to show what would be written
		const stream = unpackAnswer(parsed, true)
		for await (const str of stream) {
			if (str instanceof UiOutput) {
				ui.console.info(str)
			}
		}

		// Ask user whether to apply
		const answerUser = await ui.askYesNo("Unpack current package? (Y)es, No, ., <message>: ")
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
	const stream = unpackAnswer(parsed)
	for await (const uiElement of stream) {
		if (uiElement instanceof UiOutput) {
			ui.console.info(uiElement)
		}
		content.push(String(uiElement))
	}
	content.push("```")
	const prompt = content.join("\n")
	await chat.db.save("prompt.md", prompt)
	return { answer: "", shouldContinue: true, prompt }
}

/**
 *
 * @param {import('../cli/testing/node.js').TestInfo[]} tests
 * @param {Ui} ui
 * @returns {string[]}
 */
export function renderTests(tests, ui = new Ui()) {
	const stderr = []
	tests.forEach(t => {
		stderr.push([`${t.file}:${t.position?.[0]}:${t.position?.[1]}`, ui.createStyle({ paddingLeft: 2 })])
		if (t.file !== t.text) stderr.push([t.text, ui.createStyle({ paddingLeft: 4 })])
		if (t.doc?.error) stderr.push([t.doc.error, ui.createStyle({ paddingLeft: 6 })])
		if (t.doc?.errors?.length) stderr.push([t.doc.errors.join("\n"), ui.createStyle({ paddingLeft: 6 })])
		if (t.doc?.stack) stderr.push([t.doc.stack, ui.createStyle({ paddingLeft: 8 })])
		stderr.push([""])
	})
	return stderr.map(r => ui.render(r, true))
}

/**
 *
 * @param {import("../cli/testing/node.js").TestInfo[]} tests
 * @param {import("../cli/testing/node.js").TestType} type
 * @returns {import("../cli/testing/node.js").TestInfo[]}
 */
export function filterTests(tests, type) {
	const types = {
		fail: ["fail", "cancelled", "types"],
	}
	return tests.filter(t => (types[type] ?? [type]).includes(t.type))
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

	let ans = await ui.askYesNo(`\n${MAGENTA}? Do you want to continue fixing ${type} tests? (y)es, (n)o, (s)how, ., <message> % `)

	const arr = filterTests(tests, type)
	ui.console.info("")

	/** @type {string[]} */
	const stderr = renderTests(arr)
	if (["show", "s"].includes(ans.toLowerCase())) {
		stderr.forEach(s => ui.console.info(s))
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
	if (stderr.length) {
		content.push("```stderr")
		stderr.forEach(a => content.push(a))
		content.push("```")
	}
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
	try {
		const answered = await decodeAnswer({ ui, chat, options })
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
 * @deprecated use ChatCliApp.runTests instead.
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
		options = {},
		step = 1,
	} = input
	const content = []
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

	await chat.saveTests(parsed, result.stderr, result.stdout, step)

	// Append test output to log
	parsed.tests.filter(t => t.type === "fail")
	content.push("#### pnpm test:all")
	const rows = renderTests(parsed.tests, ui)
	content.push("```stdeerr")
	rows.forEach(r => content.push(r))
	content.push("")
	content.push(result.stderr)
	content.push("```")
	await chat.db.append("prompt.md", content.join("\n"))

	// Parse test results
	const fail = parsed.counts.get("fail") ?? 0
	const cancelled = parsed.counts.get("cancelled") ?? 0
	const types = parsed.counts.get("types") ?? 0
	const todo = parsed.counts.get("todo") ?? 0
	const skip = parsed.counts.get("skip") ?? 0
	// const { fail, cancelled, pass, todo, skip, types } = parsed.counts
	ui.overwriteLine("  " + testingStatus(parsed, ui.formats.timer(Date.now() - now)))
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
