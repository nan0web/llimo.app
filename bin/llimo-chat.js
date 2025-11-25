#!/usr/bin/env node
import process from "node:process"
import { spawn } from "node:child_process"
import { FileSystem, Path } from "../src/utils.js"
import AI from "../src/utils/AI.js"
import Git from "../src/utils/Git.js"
import Chat from "../src/utils/Chat.js"
import { packMarkdown } from "../src/llm/pack.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 3
const DEFAULT_MODEL = "gpt-oss-120b"

/**
 * Main chat loop
 *
 * @todo extract step blocks into separate isolated functions if possible in src/** and tests for them.
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const path = new Path()
	const git = new Git()
	const ai = new AI()

	let inputData = ""
	let inputFile = null

	// 1. Get input data
	if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) inputData += chunk
	} else if (argv.length > 0) {
		inputFile = path.resolve(argv[0])
		inputData = await fs.readFile(inputFile, "utf-8")
	} else {
		console.error("❌ No input provided.")
		process.exit(1)
	}

	// 2. Initialize chat
	const chat = new Chat()
	await chat.init()
	console.info(`> no chat history found, creating new chat (${chat.id})`)

	// 3. Prepare input file
	if (inputFile) {
		const chatInputFile = path.resolve(chat.dir, path.basename(inputFile))
		await fs.save(chatInputFile, inputData)
		console.info(`> preparing ${path.basename(inputFile)} (${inputFile})`)
		console.info(`+ ${path.basename(inputFile)} (${chatInputFile})`)
		console.info(`  copied to chat session`)
		inputData = `- [](${path.basename(inputFile)})\n${inputData}`
	}

	// 4. Pack input into prompt.md
	const packedPrompt = await packMarkdown(inputData, chat.dir)
	await chat.savePrompt(packedPrompt)
	const promptPath = path.resolve(chat.dir, "prompt.md")
	console.info(`node bin/llimo-pack.js ${path.basename(inputFile) || 'stdin'} chat/${chat.id}/prompt.md`)
	console.info(`+ prompt.md (${promptPath})`)
	const stats = await fs.stat(promptPath)
	const format = new Intl.NumberFormat("en-US").format
	console.info(`  injected ${packedPrompt.split("#### [").length - 1} file(s).`)
	console.info(`  Prompt size: ${format(stats.size)} bytes — ${packedPrompt.split("#### [").length - 1} file(s).`)

	// 5. Chat loop
	let step = 1
	let consecutiveErrors = 0
	const messages = await chat.getMessages()

	while (true) {
		console.info(`\nstep ${step}. ${new Date().toISOString()}`)

		// 5.1 Get AI response
		const modelInfo = ai.getModel(DEFAULT_MODEL)
		console.info(`\nsending prompt to API (streaming)`)
		console.info(`model [${DEFAULT_MODEL}](@${modelInfo.provider}) → $${modelInfo.inputPrice}/MT ← $${modelInfo.outputPrice}/MT (cache - $${modelInfo.cachePrice}/MT)`)
		console.info(`\n! batch processing has 50% discount comparing to streaming\n`)

		const startTime = Date.now()
		let fullResponse = ""
		let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
		let thinkingTokens = 0
		let writingTokens = 0

		// Progress tracking
		let lastProgressUpdate = 0
		const progressInterval = setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1000
			const totalTokens = usage.promptTokens + usage.completionTokens
			const speed = totalTokens / elapsed
			const cost = (usage.promptTokens / 1e6 * modelInfo.inputPrice) + (usage.completionTokens / 1e6 * modelInfo.outputPrice)

			let progressLine = `chat progress → ${format(totalTokens)}T | ${format(speed)}T/s | ${elapsed.toFixed(3)}s | $${cost.toFixed(3)}`
			if (modelInfo.cachePrice && usage.cacheTokens) {
				progressLine += `\n     thinking ← ${format(thinkingTokens)}T | ${format(thinkingTokens / elapsed)}T/s | ${elapsed.toFixed(3)}s | $${(thinkingTokens / 1e6 * modelInfo.inputPrice).toFixed(3)}`
			}
			if (thinkingTokens) {
				progressLine += `\n     writing  ← ${format(writingTokens)}T | ${format(writingTokens / elapsed)}T/s | ${elapsed.toFixed(3)}s | $${(writingTokens / 1e6 * modelInfo.outputPrice).toFixed(3)}`
			}

			// Clear previous lines and print new progress
			process.stdout.write('\r\x1b[K') // Clear line
			process.stdout.write(`\x1b[2A\x1b[K`) // Move up 2 lines and clear
			process.stdout.write(`\x1b[2A\x1b[K`) // Move up 2 lines and clear
			console.info(`                 tokens  | speed    | time   | cost`)
			console.info(progressLine)
		}, 1000 / PROGRESS_FPS)

		const stream = await ai.streamText(DEFAULT_MODEL, [
			{ role: "user", content: packedPrompt },
			...messages
		])

		for await (const part of stream) {
			if (part.type === 'text-delta') fullResponse += part.textDelta
			if (part.type === 'usage') usage = part.usage
		}
		clearInterval(progressInterval)

		// Final progress update
		const elapsed = (Date.now() - startTime) / 1000
		const totalTokens = usage.promptTokens + usage.completionTokens
		const speed = totalTokens / elapsed
		const cost = (usage.promptTokens / 1e6 * modelInfo.inputPrice) + (usage.completionTokens / 1e6 * modelInfo.outputPrice)
		console.info(`      total      ${format(totalTokens)}T | ${format(speed)}T/s | ${elapsed.toFixed(2)}s | $${cost.toFixed(3)}`)

		await chat.saveAnswer(fullResponse)
		console.info(`\n+ think.md (${path.resolve(chat.dir, "think.md")})`)
		console.info(`+ answer.md (${path.resolve(chat.dir, "answer.md")})`)

		// 5.2 Decode answer
		console.info(`\ndecoding answer`)
		const promptMd = path.resolve(chat.dir, "prompt.md")
		await fs.writeFile(promptMd, `echo '\`\`\`bash' # > chat/${chat.id}/prompt.md\n`, { flag: "a" })
		await fs.writeFile(promptMd, `node bin/llimo-unpack.js chat/${chat.id}/answer.md # >> chat/${chat.id}/prompt.md 2>&1\n`, { flag: "a" })

		const {
			stdout: unpackStdout
		} = await runCommand(`node bin/llimo-unpack.js chat/${chat.id}/answer.md`)
		await fs.writeFile(promptMd, unpackStdout, { flag: "a" })
		await fs.writeFile(promptMd, `echo '\`\`\`' # >> chat/${chat.id}/prompt.md\n`, { flag: "a" })

		// 5.3 Run tests
		console.info(`\nrunning tests`)
		await fs.writeFile(promptMd, `pnpm test # >> chat/${chat.id}/prompt.md\n`, { flag: "a" })
		const {
			stdout: testStdout, exitCode: testExitCode
		} = await runCommand("pnpm test")
		await fs.writeFile(promptMd, testStdout, { flag: "a" })

		const testFailed = testStdout.includes("fail") && testStdout.split("fail")[1].trim().split(" ")[0] !== "0"

		// 5.4 Check conditions
		if (!testFailed) {
			console.info(`All tests passed, no typed mistakes.`)
			// @todo it is hardcoded here, must be changed to the variable,
			// format: 2511/llimo-chat/done | 2511/llimo-chat/fail
			await git.renameBranch(`2511/llimo-chat/done`)
			await git.push(`2511/llimo-chat/done`)
			break
		}

		if (testExitCode !== 0) {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				// @todo it is hardcoded here, must be changed to the variable,
				// format: 2511/llimo-chat/done | 2511/llimo-chat/fail
				await git.renameBranch(`2511/llimo-chat/fail`)
				break
			}
		} else {
			consecutiveErrors = 0
		}

		// 5.5 Commit and continue
		await git.commitAll(`step ${step}: response and test results`)
		step++
	}
}

/**
 * Run a command and return output
 * @todo show the command output in a progress withing a few lines with cursor up.
 */
async function runCommand(command, cwd = process.cwd()) {
	return new Promise((resolve) => {
		const child = spawn(command, [], { shell: true, cwd, stdio: ["pipe", "pipe", "pipe"] })
		let stdout = ""
		let stderr = ""
		child.stdout.on("data", (d) => stdout += d)
		child.stderr.on("data", (d) => stderr += d)
		child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }))
	})
}

main().catch(err => {
	console.error("❌ Fatal error in llimo-chat:", err)
	process.exit(1)
})
