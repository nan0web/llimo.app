/**
 * Isolated helper functions for {@link bin/llimo-chat.js}.
 *
 * They do **not** depend on any global state, making them easy to unit‑test.
 *
 * @module utils/chatSteps
 */
import { ReadStream } from "node:tty"
import readline from "node:readline"

import Chat from "./Chat.js"
import AI from "./AI.js"
import { generateSystemPrompt } from "./system.js"
import { unpackAnswer } from "./unpack.js"
import { BOLD, GREEN, ITALIC, RESET, overwriteLine, cursorUp } from "../utils/ANSI.js"
import FileSystem from "../utils/FileSystem.js"
import MarkdownProtocol from "../utils/Markdown.js"

/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv                CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {ReadStream} [stdin=process.stdin]
 * @returns {Promise<{input:string,inputFile:string|null}>}
 */
export async function readInput(argv, fs, stdin = process.stdin) {
	let input = ""
	let inputFile = null

	if (!stdin.isTTY) {
		// piped stdin
		for await (const chunk of stdin) input += chunk
	} else if (argv.length > 0) {
		inputFile = fs.path.resolve(argv[0])
		input = await fs.readFile(inputFile, "utf-8")
	} else {
		throw new Error("❌ No input provided.")
	}
	return { input, inputFile }
}

/**
 * Initialise a {@link Chat} instance (or re‑use an existing one) and
 * persist the current chat ID.
 *
 * The original implementation accepted a single options object.
 * For compatibility with the test suite we also support the legacy
 * positional signature: `initialiseChat(ChatClass, fsInstance)`.
 *
 * @param {object} [input] either the Chat class
 *   itself (positional form) or an options object (named form).
 * @param {typeof Chat} [input.ChatClass] required only when using the positional form.
 * @param {FileSystem} [input.fs] required only when using the positional form.
 * @param {string} [input.root] chat root directory
 * @param {boolean} [input.isNew] additional options when using the positional form.
 * @returns {Promise<{chat: Chat, currentFile: string}>}
 */
export async function initialiseChat(input = {}) {
	const {
		ChatClass = Chat,
		fs = new FileSystem(),
		isNew = false,
		root = "chat",
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
			console.info(`+ loaded ${format(chat.messages.length)} messages from existing chat ${chat.id}`)
		} else {
			console.info(`+ ${chat.id} empty chat loaded`)
		}
	} else {
		if (!isNew) {
			console.info(`- no chat history found`)
		}
		console.info(`${GREEN}+ ${chat.id} new chat created${RESET}`)
		await chat.clear()

		const system = { role: "system", content: "" }
		system.content += await generateSystemPrompt()

		const systemFiles = ["system.md", "agent.md"]
		for (const file of systemFiles) {
			if (await fs.exists(file)) {
				const content = await fs.load(file) || ""
				console.info(`${GREEN}+ ${file}${RESET} loaded ${ITALIC}${format(Buffer.byteLength(content))} bytes${RESET}`)
				system.content += "\n\n" + content
			}
		}

		if (system.content) {
			console.info(`  system instructions ${ITALIC}${BOLD}${format(Buffer.byteLength(system.content))} bytes${RESET}`)
		}

		chat.add(system)
	}
	await fs.save(currentFile, chat.id)

	return { chat, currentFile }
}

/**
 * Copy the original input file into the chat directory for later reference.
 *
 * @param {string|null} inputFile   absolute path of the source file (or null)
 * @param {string}      input       raw text (used when `inputFile` is null)
 * @param {Chat}        chat
 * @returns {Promise<void>}
 */
export async function copyInputToChat(inputFile, input, chat) {
	if (!inputFile) return
	const file = chat.db.path.basename(inputFile)
	const full = chat.db.path.resolve(file)
	await chat.db.save(file, input)
	console.info(`> preparing ${file} (${inputFile})`)
	console.info(`+ ${file} (${full})`)
	console.info(`  copied to chat session`)
}

/**
 * Pack the input into the LLM prompt, store it and return statistics.
 *
 * @param {Function} packMarkdown – function that returns `{text, injected}`
 * @param {string}   input
 * @param {Chat}     chat      – Chat instance (used for `savePrompt`)
 * @returns {Promise<{packedPrompt:string,injected:string[],promptPath:string,stats:any}>}
 */
export async function packPrompt(packMarkdown, input, chat) {
	const { text: packedPrompt, injected } = await packMarkdown({ input })
	const promptPath = await chat.savePrompt(packedPrompt)

	const stats = await chat.fs.stat(promptPath)
	const format = new Intl.NumberFormat("en-US").format
	console.info(
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
 * @param {import("../llm/AI.js").StreamOptions} options
 * @returns {{stream:AsyncIterable<any>, result:any}}
 */
export function startStreaming(ai, model, chat, options) {
	const result = ai.streamText(model, chat.messages, options)
	const stream = result.textStream ?? result
	return { stream, result }
}

/**
 * Decode the answer markdown and append the test run command.
 * Returns true - if decoded and all tests passed,
 *         false - if decoded and tests fail,
 *         "." | "no" | string - if user did not accept answer and provided details.
 *
 * @param {Chat} chat           – Chat instance (used for paths)
 * @param {(cmd:string, options?: { onData?: (data) => void })=>Promise<{stdout:string,stderr:string,exitCode:number}>} runCommand
 * @param {boolean} [isYes] Is always Yes to user prompts.
 * @returns {Promise<boolean | string>}
 */
export async function decodeAnswerAndRunTests(chat, runCommand, isYes = false) {
	const logs = []
	const answer = chat.messages.slice().pop()
	if ("assistant" !== answer?.role) {
		throw new Error(`Recent message is not an assistant's but "${answer?.role}"`)
	}
	/** @type {string} */
	const content = String(answer.content)
	const parsed = await MarkdownProtocol.parse(content)
	let prompt = isYes ? "yes" : ""

	logs.push("#### llimo-unpack")
	logs.push("```bash")
	if (!isYes) {
		// Dry‑run unpack to show what would be written
		const stream = unpackAnswer(parsed, true)
		for await (const str of stream) {
			logs.push(str)
			console.info(str)
		}

		// -------------------------------------------------
		// Interactive question – ask the user whether to apply
		// -------------------------------------------------
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		})
		const answerUser = await new Promise(resolve => {
			rl.question(
				"Unpack current package? (Y)es, No, ., <message>: ",
				ans => {
					rl.close()
					resolve(ans.trim().toLowerCase())
				}
			)
		})
		const lower = String(answerUser).trim().toLocaleLowerCase()
		if (["yes", "y", ""].includes(lower)) {
			prompt = "yes"
		}
		else if (["no", "n"].includes(lower)) {
			return "no"
		}
		else if (["."].includes(lower)) {
			return "."
		}
		else {
			return answerUser
		}
	} // end !isYes

	if ("yes" === prompt) {
		const stream = unpackAnswer(parsed)
		for await (const str of stream) {
			console.info(str)
			logs.push(str)
		}
	}
	logs.push("```")
	await chat.db.save("prompt.md", logs.join("\n"))

	// -------------------------------------------------
	// Run `pnpm test:all` and show recent output (max 3 lines)
	// -------------------------------------------------
	const recent = []
	let prevLines = 0
	const onData = (chunk) => {
		const txt = String(chunk)
		const lines = txt.split(/\r?\n/).filter(Boolean)
		for (const line of lines) {
			recent.push(line)
			if (recent.length > 3) recent.shift()
		}
		if (prevLines) process.stdout.write(cursorUp(prevLines))
		prevLines = recent.length
		recent.forEach(l => console.info(overwriteLine(l)))
	}

	const { stdout: testStdout, stderr: testStderr } = await runCommand("pnpm test:all", { onData })
	logs.push("#### pnpm test:all")
	logs.push("```bash")
	logs.push(testStderr)
	logs.push(testStdout)
	logs.push("```")
	await chat.db.save("prompt.md", logs.join("\n"))

	const testFailed =
		testStdout.includes("fail") &&
		testStdout.split("fail")[1].trim().split(" ")[0] !== "0"
	if (!testFailed) {
		console.info(`All tests passed, no typed mistakes.`)
		return true
	}
	return false
}
