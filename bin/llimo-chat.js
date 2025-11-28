#!/usr/bin/env node
import process from "node:process"
import { spawn } from "node:child_process"
import {
	FileSystem,
	GREEN,
	Path,
	RESET,
	YELLOW,
	cursorUp,
	overwriteLine,
} from "../src/utils.js"
import AI from "../src/llm/AI.js"
import Git from "../src/utils/Git.js"
import Chat from "../src/llm/Chat.js"
import { packMarkdown } from "../src/llm/pack.js"
import {
	readInput,
	initialiseChat,
	copyInputToChat,
	packPrompt,
	startStreaming,
	decodeAnswerAndRunTests,
} from "../src/llm/chatSteps.js"
import ModelProvider from "../src/llm/ModelProvider.js"
import { formatChatProgress } from "../src/llm/chatProgress.js" // ← fixed import path
import Usage from "../src/llm/LanguageModelUsage.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 9
// const DEFAULT_MODEL = "gpt-oss-120b"
// const DEFAULT_MODEL = "zai-glm-4.6"
// const DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"
// const DEFAULT_MODEL = "qwen-3-32b"
// const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
const DEFAULT_MODEL = "x-ai/grok-4-fast"


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
async function runCommand(command, { cwd = process.cwd(), onData = () => { } }) {
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
	const models = await loadModels()
	const ai = new AI({ models })

	const isNew = argv.includes("--new")
	const isYes = argv.includes("--yes")

	// Verify model existence
	/** @type {import("../src/llm/AI.js").ModelInfo} */
	const model = ai.getModel(DEFAULT_MODEL)
	if (!model) {
		console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
		process.exit(1)
	}

	const format = new Intl.NumberFormat("en-US").format
	const pricing = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format
	const valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format

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

	// 1. read input (stdin / file)
	const { input, inputFile } = await readInput(argv, fs)

	// 2. initialise / load chat
	const { chat } = await initialiseChat({ ChatClass: Chat, fs, isNew })

	// 3. copy source file to chat directory (if any)
	await copyInputToChat(inputFile, input, chat)

	// 4. pack prompt – prepend system.md if present
	const packed = await packPrompt(packMarkdown, input, chat)
	let packedPrompt = packed.packedPrompt

	// 5. chat loop
	let step = 1
	let consecutiveErrors = 0

	// Define branch names in one place – easy to change later.
	const DONE_BRANCH = `2511/llimo-chat/done`
	const FAIL_BRANCH = `2511/llimo-chat/fail`

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
		let usage = new Usage()
		let timeInfo
		const clock = { startTime, reasonTime: 0, answerTime: 0 }

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
					usage = part.usage
				}
				parts.push(part)
			}

			if ("resolved" === result._totalUsage?.status?.type) {
				usage = result._totalUsage.status.value
			} else {
				unknown.push(["Unknown _totalUsage.status type", result._totalUsage?.status?.type])
			}
			if (result._steps?.status?.type === "resolved") {
				const step0 = result._steps.status.value?.[0]
				if (step0?.usage) usage = step0.usage
				// keep header‑rate‑limit information for future use
				if (step0?.response?.headers) {
					const limits = Object.entries(step0.response.headers).filter(([k]) =>
						k.startsWith("x-ratelimit-")
					)
					// @todo future: apply limits
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
			if (isRateLimit(err)) {
				console.warn(`${YELLOW}⚠️ Rate limit reached – waiting before retry${RESET}`)
				await new Promise((r) => setTimeout(r, 6e3))
				continue
			}
			console.error(`❌ Fatal error in llimo‑chat (AI):`, err.stack ?? err.message)
			process.exit(1)
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
		const testsCode = await decodeAnswerAndRunTests(chat, runCommand, isYes)
		const input = await chat.db.load("prompt.md")
		const data = await packPrompt(packMarkdown, input, chat)
		packedPrompt = data.packedPrompt

		// 7. check if tests passed – same logic as original script
		if (true === testsCode) {
			// Task is complete, let's commit and exit
			console.info(`  ${GREEN}+ Task is complete${RESET}`)
			await git.renameBranch(DONE_BRANCH)
			await git.push(DONE_BRANCH)
			break
		}
		else {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				await git.renameBranch(FAIL_BRANCH)
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
	console.error("❌ Fatal error in llimo‑chat:", err.stack || err.message)
	process.exit(1)
})
