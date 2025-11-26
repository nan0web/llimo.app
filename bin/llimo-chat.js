#!/usr/bin/env node
import process from "node:process"
import { spawn } from "node:child_process"
import { FileSystem, GREEN, Path, RESET, YELLOW } from "../src/utils.js"
import AI from "../src/utils/AI.js"
import Git from "../src/utils/Git.js"
import Chat from "../src/utils/Chat.js"
import { packMarkdown } from "../src/llm/pack.js"
import {
	readInput,
	initialiseChat,
	copyInputToChat,
	packPrompt,
	startStreaming,
	decodeAnswerAndRunTests,
	commitStep,
} from "../src/utils/chatSteps.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 3
const DEFAULT_MODEL = "gpt-oss-120b"

/**
 * Helper – determines whether an AI error is a rate‑limit (HTTP 429)
 *
 * @param {any} err
 * @returns {boolean}
 */
function isRateLimit(err) {
	if (err?.status === 429 || err?.statusCode === 429) return true
	if (typeof err?.message === "string" && /429/.test(err.message)) return true
	return false
}

/**
 * Run a command and return output
 */
async function runCommand(command, cwd = process.cwd()) {
	return new Promise((resolve) => {
		const child = spawn(command, [], { shell: true, cwd, stdio: ["pipe", "pipe", "pipe"] })
		let stdout = ""
		let stderr = ""
		child.stdout.on("data", (d) => (stdout += d))
		child.stderr.on("data", (d) => (stderr += d))
		child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }))
	})
}

/**
 * Main chat loop
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const pathUtil = new Path()
	const git = new Git()
	const ai = new AI()

	// Check API key before starting
	const modelInfo = ai.getModel(DEFAULT_MODEL)
	if (!modelInfo) {
		console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
		process.exit(1)
	}

	// Pre-validate API key availability
	try {
		ai.getProvider(modelInfo.provider)
	} catch (err) {
		console.error(`❌ ${err.message}`)
		process.exit(1)
	}

	// 1. read input (stdin / file)
	const { input, inputFile } = await readInput(argv, fs)

	// 2. initialise / load chat
	const { chat } = await initialiseChat(Chat, fs)

	// 3. copy source file to chat directory (if any)
	await copyInputToChat(inputFile, input, chat)

	// 4. pack prompt
	const { packedPrompt } = await packPrompt(packMarkdown, input, chat)

	// 5. chat loop
	let step = 1
	let consecutiveErrors = 0
	const messages = await chat.getMessages()

	while (true) {
		console.info(`\nstep ${step}. ${new Date().toISOString()}`)

		console.info(`\nsending prompt to API (streaming)`)
		console.info(
			`model [${DEFAULT_MODEL}](@${modelInfo.provider}) → $${modelInfo.inputPrice}/MT ← $${modelInfo.outputPrice}/MT (cache - $${modelInfo.cachePrice}/MT)`
		)

		// batch discount info
		if (modelInfo.cachePrice && modelInfo.cachePrice < modelInfo.inputPrice) {
			const discount = Math.round((1 - modelInfo.cachePrice / modelInfo.inputPrice) * 100)
			console.info(`\n! batch processing has ${discount}% discount compared to streaming\n`)
		}

		const startTime = Date.now()
		let fullResponse = ""
		let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
		const format = new Intl.NumberFormat("en-US").format

		// ---------- progress tracking ----------
		const progressInterval = setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1e3
			const totalTokens = usage.promptTokens + usage.completionTokens
			const speed = totalTokens / elapsed
			const cost =
				(usage.promptTokens / 1e6) * modelInfo.inputPrice +
				(usage.completionTokens / 1e6) * modelInfo.outputPrice

			const line = `chat progress → ${format(totalTokens)}T | ${format(speed)}T/s | ${elapsed.toFixed(3)}s | $${cost.toFixed(3)}`
			// clear current line and rewrite (no newline)
			process.stdout.write("\r\x1b[K")
			process.stdout.write(line)
		}, 1e3 / PROGRESS_FPS)

		try {
			// 5.2. stream AI answer (no await on iterator)
			const { stream, result } = startStreaming(ai, DEFAULT_MODEL, packedPrompt, messages)

			for await (const part of stream) {
				if (part.type === "text-delta") fullResponse += part.textDelta
				if (part.type === "usage") usage = part.usage
			}
			// persist raw result for debugging
			const chatDb = new FileSystem({ cwd: chat.dir })
			await chatDb.save("response.json", JSON.stringify(result, null, 2))
		} catch (err) {
			clearInterval(progressInterval)

			if (isRateLimit(err)) {
				console.warn(`${YELLOW}⚠️ Rate limit reached – waiting before retry${RESET}`)
				await new Promise((r) => setTimeout(r, 5000))
				continue // retry same step
			}
			console.error(`❌ Fatal error in llimo‑chat (AI):`, err)
			process.exit(1)
		} finally {
			clearInterval(progressInterval)
		}

		// final progress line (with newline)
		const elapsed = (Date.now() - startTime) / 1e3
		const totalTokens = usage.promptTokens + usage.completionTokens
		const speed = totalTokens / elapsed
		const cost = (usage.promptTokens / 1e6) * modelInfo.inputPrice + (usage.completionTokens / 1e6) * modelInfo.outputPrice
		console.info(`\n      total      ${format(totalTokens)}T | ${format(speed)}T/s | ${elapsed.toFixed(2)}s | $${cost.toFixed(3)}`)

		// persist answer
		await chat.saveAnswer(fullResponse)
		console.info(`\n+ think.md (${pathUtil.resolve(chat.dir, "think.md")})`)
		console.info(`+ answer.md (${pathUtil.resolve(chat.dir, "answer.md")})`)

		// 6. decode answer & run tests
		await decodeAnswerAndRunTests(chat, runCommand)

		// 7. check if tests passed – same logic as original script
		const testStdout = await fs.readFile(pathUtil.resolve(chat.dir, "prompt.md"), "utf-8")
		const testFailed = testStdout.includes("fail") && testStdout.split("fail")[1].trim().split(" ")[0] !== "0"

		if (!testFailed) {
			await git.renameBranch(`2511/llimo-chat/done`)
			await git.push(`2511/llimo-chat/done`)
			break
		}

		if (testFailed) {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				await git.renameBranch(`2511/llimo-chat/fail`)
				break
			}
		} else {
			consecutiveErrors = 0
		}

		// 8. commit step and continue
		await commitStep(git, `step ${step}: response and test results`)
		step++
	}
}

/* -------------------------------------------------------------------------- */

main().catch((err) => {
	console.error("❌ Fatal error in llimo‑chat:", err)
	process.exit(1)
})
