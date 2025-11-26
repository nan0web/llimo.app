/**
 * Isolated helper functions for {@link bin/llimo-chat.js}.
 *
 * They do **not** depend on any global state, making them easy to unit‑test.
 *
 * @module utils/chatSteps
 */
import { ReadStream } from "node:tty"
import Chat from "./Chat.js"
import FileSystem from "./FileSystem.js"
import Git from "./Git.js"

/**
 * Read the input either from STDIN or from the first CLI argument.
 *
 * @param {string[]} argv                CLI arguments (already sliced)
 * @param {FileSystem} fs
 * @param {ReadStream} [stdin=process.stdin]
 * @returns {Promise<{input:string,inputFile:string|null}>}
 */
export async function readInput(argv, fs, stdin = process.stdin) {
	debugger
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
 * @param {typeof Chat} ChatClass – the class, **not** an instance
 * @param {FileSystem} fs
 * @param {string} [root="chat"]
 * @returns {Promise<{chat:any,currentFile:string}>}
 */
export async function initialiseChat(ChatClass, fs, root = "chat") {
	const currentFile = fs.path.resolve(root, "current")
	let id

	if (await fs.exists(currentFile)) id = await fs.load(currentFile) || undefined

	const chat = new ChatClass({ id, root, cwd: fs.cwd })
	await chat.init()

	if (id === chat.id) {
		console.info(`+ ${chat.id} chat loaded`)
	} else {
		console.info(`- no chat history found`)
		console.info(`+ ${chat.id} new chat created`)
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
 * The function **does not** `await` the stream – the caller decides when to
 * iterate over it.
 *
 * @param {any} ai                – instance of {@link AI}
 * @param {string} modelId
 * @param {string} packedPrompt
 * @param {Array}  messages
 * @returns {{stream:AsyncIterable<any>, result:any}}
 */
export function startStreaming(ai, modelId, packedPrompt, messages) {
	const result = ai.streamText(modelId, [
		{ role: "user", content: packedPrompt },
		...messages,
	])
	const stream = result.textStream ?? result
	return { stream, result }
}

/**
 * Decode the answer markdown and append the test run command.
 *
 * @param {Chat} chat           – Chat instance (used for paths)
 * @param {Function} runCommand – `(cmd:string)=>Promise<{stdout:string,stderr:string,exitCode:number}>`
 * @returns {Promise<void>}
 */
export async function decodeAnswerAndRunTests(chat, runCommand) {
	// prepend unpack block
	await chat.db.append(
		"prompt.md",
		`echo '\`\`\`bash' > ${chat.dir}/prompt.md\n`
	)
	await chat.db.append(
		"prompt.md",
		`node bin/llimo-unpack.js ${chat.dir}/answer.md # >> ${chat.dir}/prompt.md 2>&1\n`
	)

	const { stdout: unpackStdout } = await runCommand(
		`node bin/llimo-unpack.js ${chat.dir}/answer.md`
	)
	await chat.db.append("prompt.md", unpackStdout)
	await chat.db.append("prompt.md", `echo '\`\`\`' # >> ${chat.dir}/prompt.md\n`)

	// run tests
	await chat.db.append(
		"prompt.md",
		`pnpm test # >> ${chat.dir}/prompt.md\n`
	)
	const { stdout: testStdout, stderr: testStderr } = await runCommand("pnpm test")
	await chat.db.append("prompt.md", testStderr + testStdout)

	const testFailed =
		testStdout.includes("fail") &&
		testStdout.split("fail")[1].trim().split(" ")[0] !== "0"
	if (!testFailed) {
		console.info(`All tests passed, no typed mistakes.`)
	}
}

/**
 * Helper to commit the current step.
 *
 * @param {Git} git
 * @param {string} message
 * @returns {Promise<void>}
 */
export async function commitStep(git, message) {
	await git.commitAll(message)
}
