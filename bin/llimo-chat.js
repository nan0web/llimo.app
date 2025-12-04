#!/usr/bin/env node
import process from "node:process"
import { spawn } from "node:child_process"
import {
	FileSystem,
	GREEN,
	Path,
	RESET,
	RED,
	YELLOW,
	cursorUp,
	overwriteLine,
} from "../src/utils.js"
import AI from "../src/llm/AI.js"
import TestAI from "../src/llm/TestAI.js"
import Git from "../src/utils/Git.js"
import Chat from "../src/llm/Chat.js"
import { packMarkdown } from "../src/llm/pack.js"
import {
	initialiseChat,
	copyInputToChat,
	packPrompt,
	startStreaming,
	decodeAnswerAndRunTests,
} from "../src/llm/chatSteps.js"
import ModelProvider from "../src/llm/ModelProvider.js"
import { formatChatProgress } from "../src/llm/chatProgress.js"
import LanguageModelUsage from "../src/llm/LanguageModelUsage.js"
import ChatOptions from "../src/Chat/Options.js"
import Ui from "../src/cli/Ui.js"
import { parseArgv } from "../src/cli/argvHelper.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 9
// const DEFAULT_MODEL = "gpt-oss-120b"
// const DEFAULT_MODEL = "zai-glm-4.6"
// const DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"
// const DEFAULT_MODEL = "qwen-3-32b"
// const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
const DEFAULT_MODEL = process.env.LLIMO_MODEL || "x-ai/grok-4-fast"

/**
 * Create progress interval to call the fn() with provided fps.
 * @param {({ elapsed: number, startTime: number }) => void} fn
 * @param {number} [startTime]
 * @param {number} [fps]
 * @returns {number}
 */
function createProgress(fn, startTime = Date.now(), fps = PROGRESS_FPS) {
	return setInterval(() => {
		const elapsed = (Date.now() - startTime) / 1e3
		fn({ elapsed, startTime })
	}, 1e3 / fps)
}

function isWindowLimit(err) {
	return [err?.status, err?.statusCode].includes(400) && err?.data?.code === "context_length_exceeded"
}

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
 * Execute a shell command, return stdout / stderr / exit code
 * @param {string} command
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {(data) => void} [options.onData]
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
async function runCommand(command, { cwd = process.cwd(), onData = (d) => process.stdout.write(d) } = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, [], { shell: true, cwd, stdio: ["pipe", "pipe", "pipe"] })
		let stdout = ""
		let stderr = ""
		child.stdout.on("data", (d) => {
			stdout += d
			onData(d)
		})
		child.stderr.on("data", (d) => {
			stderr += d
			onData(new Error(d))
		})
		child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }))
	})
}

async function loadModels() {
	const provider = new ModelProvider()

	let str = "Loading models …"
	console.info(str)
	let name = "", raw = "", models = [], pros = new Set()
	const loading = createProgress(({ elapsed }) => {
		let str = "Loading models …"
		if (name) str = `Loading models @${name} (${models.length} in ${elapsed}ms)`
		process.stdout.write(overwriteLine(str))
	})
	const map = await provider.getAll({
		onBefore: (n) => { name = n },
		onData: (n, r, m) => {
			pros.add(n)
			name = n
			raw = r
			models.push(...m)
		}
	})
	map.forEach((info) => pros.add(info.provider))

	process.stdout.write(overwriteLine())
	process.stdout.write(cursorUp(1) + overwriteLine(`Loaded ${map.size} models from ${pros.size} providers`))
	console.info("")
	clearInterval(loading)
	return map
}

/**
 * Main chat loop
 */
async function main(argv = process.argv.slice(2)) {
	console.info(RESET)
	const fs = new FileSystem()
	const path = new Path()
	const git = new Git({ dry: true })
	const ui = new Ui()

	// Parse arguments
	const command = parseArgv(argv, ChatOptions)
	const { argv: cleanArgv, isNew, isYes, testMode, testDir } = command

	const format = new Intl.NumberFormat("en-US").format
	const pricing = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format
	const valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format

	let ai
	if (testMode || testDir) {
		console.info(`${GREEN}🧪 Test mode enabled with chat directory: ${testDir}${RESET}`)
		ai = new TestAI()
	} else {
		const models = await loadModels()
		ai = new AI({ models })

		// Verify model existence
		/** @type {import("../src/llm/AI.js").ModelInfo} */
		const model = ai.findModel(DEFAULT_MODEL)
		if (!model) {
			console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
			process.exit(1)
		}

		const inputPer1MT = parseFloat(model.pricing?.prompt || "0") * 1e6
		const outputPer1MT = parseFloat(model.pricing?.completion || "0") * 1e6
		const cachePer1MT = parseFloat(model.pricing?.input_cache_read || "0") + parseFloat(model.pricing?.input_cache_write || "0")

		console.info(`> ${model.id} selected with modality ${model.architecture?.modality ?? "?"}`)
		console.info(`  pricing: → ${pricing(inputPer1MT)} ← ${pricing(outputPer1MT)} (cache: ${pricing(cachePer1MT)})`)
		console.info(`  provider: ${model.provider}`)

		// Validate API key before proceeding
		try {
			ai.getProvider(model.provider)
		} catch (err) {
			console.error(`❌ ${err.stack || err.message}`)
			process.exit(1)
		}
	}

	// 1. read input (stdin / file) - use cleanArgv to avoid flags
	let input = ""
	let inputFile = null
	if (cleanArgv.length > 0) {
		inputFile = fs.path.resolve(cleanArgv[0])
		try {
			input = await fs.readFile(inputFile, "utf-8")
		} catch (err) {
			if (err.code === "ENOENT") {
				console.error(`❌ Input file not found: ${inputFile}`)
				process.exit(1)
			}
			throw err
		}
	} else if (!process.stdin.isTTY) {
		// piped stdin
		for await (const chunk of process.stdin) input += chunk
	} else {
		// No input provided - in test mode, load from prompt.md if exists, else error
		if (testMode || testDir) {
			const testFs = new FileSystem({ cwd: testDir })
			try {
				input = await testFs.load("prompt.md") || ""
				console.info(`${YELLOW}⚠️ No input provided in test mode; using prompt.md from ${testDir} (or empty)${RESET}`)
				if (!input) input = "Simulated test prompt"  // Default for empty test
			} catch {
				console.error(`❌ No input provided and no prompt.md in test dir: ${testDir}`)
				process.exit(1)
			}
		} else {
			throw new Error("❌ No input provided. Pipe to stdin, provide a file, or use --test-dir with prompt.md.")
		}
	}

	// 2. initialise / load chat
	const { chat } = await initialiseChat({ ui, ChatClass: Chat, fs, isNew })
	const testChatDir = testDir || chat.dir  // Use provided dir or current chat.dir

	if (testMode || testDir) {
		// In test mode, override model to test-model and use files from testChatDir
		// Skip real API calls, simulate one step
		console.info(`${GREEN}🔄 Simulating chat step using files from ${testChatDir}${RESET}`)
		const startTime = Date.now()
		const unknown = []
		let fullResponse = ""
		let reasoning = ""
		let usage = new LanguageModelUsage()
		let timeInfo
		const clock = { startTime, reasonTime: undefined, answerTime: undefined }

		const chatting = createProgress(
			() => {
				const lines = formatChatProgress({
					elapsed: (Date.now() - startTime) / 1e3,
					usage,
					clock,
					/* For test mode, create a dummy model */
					model: { pricing: { prompt: 0, completion: 0 }, architecture: { modality: "text" } },
					format: (() => "0"),  // format
					valuta: (() => "$0"),  // valuta
				})
				if (lines.length) process.stdout.write(cursorUp(lines.length) + overwriteLine(lines[lines.length - 1]))
			},
			startTime,
			PROGRESS_FPS
		)

		const chatDb = new FileSystem({ cwd: testChatDir })
		try {
			const chunks = []
			/** @type {import("../src/llm/AI.js").StreamOptions} */
			const options = {
				cwd: testChatDir,
				onChunk: (el) => {
					const chunk = el.chunk
					const words = String(chunk.text || "").split(/\s+/)
					if ("reasoning-delta" === chunk.type) {
						reasoning += chunk.text
						usage.reasoningTokens += words.length
						usage.totalTokens += words.length
						if (!clock.reasonTime) clock.reasonTime = Date.now()
					} else if ("text-delta" === chunk.type) {
						usage.outputTokens += words.length
						usage.totalTokens += words.length
						if (!clock.answerTime) clock.answerTime = Date.now()
					} else if ("raw" === chunk.type) {
						timeInfo = chunk.rawValue?.time_info
					} else {
						unknown.push(["Unknown chunk.type", chunk])
					}
					chunks.push(chunk)
				},
			}

			console.debug(timeInfo)

			chat.add({ role: "user", content: input })

			usage.inputTokens = chat.getTokensCount()

			const { stream, result } = startStreaming(ai, "test-model", chat, options)

			await chatDb.save("stream.md", "")
			const parts = []
			for await (const part of stream) {
				if ("string" === typeof part || "text-delta" == part.type) {
					fullResponse += part.text ?? part
					await chatDb.append("stream.md", part.text ?? part)
				} else if ("usage" == part.type) {
					usage = new LanguageModelUsage(part.usage)
				}
				parts.push(part)
			}

			// persist raw result for debugging (in test mode, use existing files)
			await chatDb.save("response.json", result)
			await chatDb.save("stream.json", parts)
			await chatDb.save("chunks.json", chunks)
			await chatDb.save("unknown.json", unknown)
			await chatDb.save("reason.md", reasoning)

			// In test mode, only one simulation step
			console.info(`${GREEN}✅ Test simulation complete${RESET}`)
			process.exit(0)
		} catch (err) {
			console.error(`❌ Test mode error:`, err.stack ?? err.message)
			process.exit(1)
		} finally {
			clearInterval(chatting)
		}
	}

	// Normal real AI mode continues...
	const model = ai.findModel(DEFAULT_MODEL)

	// 3. copy source file to chat directory (if any)
	await copyInputToChat(inputFile, input, chat, ui)

	// 4. pack prompt – prepend system.md if present
	const packed = await packPrompt(packMarkdown, input, chat, ui)
	let packedPrompt = packed.packedPrompt

	// 5. chat loop
	let step = 1
	let consecutiveErrors = 0

	// Define branch names in one place – easy to change later.
	// const DONE_BRANCH = `2511/llimo-chat/done`
	// const FAIL_BRANCH = `2511/llimo-chat/fail`
	const DONE_BRANCH = ""
	const FAIL_BRANCH = ""

	while (true) {
		console.info(`\nstep ${step}. ${new Date().toISOString()}`)

		console.info(`\nsending (streaming) [${DEFAULT_MODEL}](@${model.provider})`)

		// Show batch discount information
		if (model.cachePrice && model.cachePrice < model.inputPrice) {
			const discount = Math.round((1 - model.cachePrice / model.inputPrice) * 100)
			console.info(`\n! batch processing has ${discount}% discount compared to streaming\n`)
		}

		const startTime = Date.now()
		const unknown = []
		let fullResponse = ""
		let reasoning = ""
		let prev = 0
		let usage = new LanguageModelUsage()
		let timeInfo
		const clock = { startTime, reasonTime: undefined, answerTime: undefined }

		const chatting = createProgress(
			() => {
				const lines = formatChatProgress({
					elapsed: (Date.now() - startTime) / 1e3,
					usage,
					clock,
					model,
					format,
					valuta,
				})
				if (prev) process.stdout.write(cursorUp(prev))
				prev = lines.length
				lines.forEach((line) => console.info(overwriteLine(line)))
			},
			startTime,
			PROGRESS_FPS
		)

		const chatDb = new FileSystem({ cwd: chat.dir })
		let error
		try {
			const chunks = []
			/** @type {import("../src/llm/AI.js").StreamOptions} */
			const options = {
				onChunk: (el) => {
					const chunk = el.chunk
					const words = String(chunk.text || "").split(/\s+/)
					if ("reasoning-delta" === chunk.type) {
						reasoning += chunk.text
						usage.reasoningTokens += words.length
						usage.totalTokens += words.length
						if (!clock.reasonTime) clock.reasonTime = Date.now()
					} else if ("text-delta" === chunk.type) {
						usage.outputTokens += words.length
						usage.totalTokens += words.length
						if (!clock.answerTime) clock.answerTime = Date.now()
					} else if ("raw" === chunk.type) {
						timeInfo = chunk.rawValue?.time_info
					} else {
						unknown.push(["Unknown chunk.type", chunk])
					}
					chunks.push(chunk)
				},
				onError: (data) => {
					error = data.error
				},
			}

			chat.add({ role: "user", content: packedPrompt })

			usage.inputTokens = chat.getTokensCount()

			const { stream, result } = startStreaming(ai, DEFAULT_MODEL, chat, options)

			await chatDb.save("stream.md", "")
			const parts = []
			for await (const part of stream) {
				if ("string" === typeof part || "text-delta" == part.type) {
					fullResponse += part.text ?? part
					await chatDb.append("stream.md", part.text ?? part)
				} else if ("usage" == part.type) {
					usage = new LanguageModelUsage(part.usage)
				}
				parts.push(part)
			}
			if (error) throw error

			if ("resolved" === result._totalUsage?.status?.type) {
				usage = new LanguageModelUsage(result._totalUsage.status.value)
			} else {
				unknown.push(["Unknown _totalUsage.status type", result._totalUsage?.status?.type])
			}
			if (result._steps?.status?.type === "resolved") {
				const step0 = result._steps.status.value?.[0]
				if (step0?.usage) usage = new LanguageModelUsage(step0.usage)
				// keep header‑rate‑limit information for future use
				if (step0?.response?.headers) {
					const limits = Object.entries(step0.response.headers).filter(([k]) =>
						k.startsWith("x-ratelimit-")
					)
					// @todo future: apply limits to show them in the progress table.
				}
			} else {
				unknown.push(["Unknown _steps.status type", result._steps?.status?.type])
			}

			// persist raw result for debugging
			await chatDb.save("response.json", result)
			await chatDb.save("stream.json", parts)
			await chatDb.save("chunks.json", chunks)
			await chatDb.save("unknown.json", unknown)
			await chatDb.save("reason.md", reasoning)
		} catch (err) {
			clearInterval(chatting)
			// Graceful API error handling
			let shortMsg = "Unknown API error"
			if (["AI_APICallError", "APICallError", "RetryError"].includes(err.name)) {
				shortMsg = err.message.split("\n")[0] || shortMsg
				console.error(`${RED}API Error: ${shortMsg}${RESET}`)
				if (isWindowLimit(err)) {
					console.warn(`${YELLOW}Message is too long - choose another model${RESET}`)
					// @todo select another model
					continue
				}
				if (isRateLimit(err)) {
					console.warn(`${YELLOW}⚠️ Rate limit reached – waiting before retry${RESET}`)
					await new Promise((r) => setTimeout(r, 6e3))
					continue
				}
				fullResponse = `AI API failed: ${shortMsg}`
				usage.outputTokens = fullResponse.split(/\s+/).length || 0
			} else {
				console.error(`❌ Fatal error in llimo‑chat (AI):`, err.message)
				process.exit(1)
			}
		} finally {
			clearInterval(chatting)
		}

		formatChatProgress({
			elapsed: (Date.now() - startTime) / 1e3,
			usage,
			clock,
			model,
			format,
		})
		if (timeInfo) {
			console.info(timeInfo)
		}

		chat.add({ role: "assistant", content: fullResponse })
		await chat.save()
		await chat.saveAnswer(fullResponse)
		console.info("")
		if (reasoning) {
			console.info(`+ reason.md (${path.resolve(chat.dir, "reason.md")})`)
		}
		console.info(`+ answer.md (${path.resolve(chat.dir, "answer.md")})`)

		// 6. decode answer & run tests
		const { testsCode, shouldContinue } = await decodeAnswerAndRunTests(ui, chat, async (cmd, opts = {}) => runCommand(cmd, { ...opts, onData: (d) => process.stdout.write(String(d)) }), isYes)
		if (!shouldContinue) {
			break
		}
		const inputPrompt = await chat.db.load("prompt.md")
		const data = await packPrompt(packMarkdown, inputPrompt || input, chat, ui)
		packedPrompt = data.packedPrompt

		// 7. check if tests passed – same logic as original script
		if (true === testsCode) {
			// Task is complete, let's commit and exit
			console.info(`  ${GREEN}+ Task is complete${RESET}`)
			if (DONE_BRANCH) {
				await git.renameBranch(DONE_BRANCH)
				await git.push(DONE_BRANCH)
			}
			break
		}
		else {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				if (FAIL_BRANCH) {
					await git.renameBranch(FAIL_BRANCH)
				}
				break
			}
		}

		// 8. commit step and continue
		// console
		// await git.commitAll(`step ${step}: response and test results`)
		step++
	}
}

/* -------------------------------------------------------------------------- */

main().catch((err) => {
	console.error("❌ Fatal error in llimo‑chat:", err.message)
	if (err.stack && process.argv.includes("--debug")) console.error(err.stack)
	process.exit(1)
})
