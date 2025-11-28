#!/usr/bin/env node
import process from "node:process"
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
import TestAI from "../src/llm/TestAI.js"
import Git from "../src/utils/Git.js"
import Chat from "../src/llm/Chat.js"
import Usage from "../src/llm/LanguageModelUsage.js"
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
import { formatChatProgress } from "../src/llm/chatProgress.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 9

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
 * Helper function to create progress interval.
 */
function createProgress(fn, startTime = Date.now(), fps = PROGRESS_FPS) {
	return setInterval(() => {
		const elapsed = (Date.now() - startTime) / 1e3
		fn({ elapsed, startTime })
	}, 1e3 / fps)
}

async function main(argv = process.argv.slice(2)) {
	console.info(RESET)
	const fs = new FileSystem()
	const path = new Path()
	const git = new Git({ dry: true })

	const models = await loadModels()

	// Check for --test mode: load TestAI instead of real AI
	const isTest = argv.includes("--test")
	let ai
	if (isTest) {
		console.info(`${YELLOW}⚠️ Running in test mode – using TestAI${RESET}`)
		ai = new TestAI({ models })
	} else {
		ai = new AI({ models })
		const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
		const model = ai.getModel(DEFAULT_MODEL)
		if (!model) {
			console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
			process.exit(1)
		}
		ai.getProvider(model.provider) // Validate API key
		console.info(`> ${model.id} selected with modality ${model.architecture?.modality ?? "?"}`)
		console.info(`  pricing: → ${model.pricing?.prompt ? parseFloat(model.pricing.prompt) * 1e6 : 0} ← ${model.pricing?.completion ? parseFloat(model.pricing.completion) * 1e6 : 0}`)
		console.info(`  provider: ${model.provider}`)
	}

	const isNew = argv.includes("--new")
	const isYes = argv.includes("--yes")

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

	// Define branch names
	const DONE_BRANCH = `2511/llimo-chat/done`
	const FAIL_BRANCH = `2511/llimo-chat/fail`

	while (true) {
		console.info(`\nstep ${step}. ${new Date().toISOString()}`)

		const modelId = isTest ? "test-model" : "x-ai/grok-code-fast-1"
		console.info(`\nsending (streaming) [${modelId}](@${isTest ? 'test' : 'x-ai'})`)

		const startTime = Date.now()
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
					model: ai.getModel(modelId) || {},
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
			let chunks = []
			if (!isTest) {
				// Real streaming logic for non-test mode
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
							// Handle unknown in non-test too
						}
						chunks.push(chunk)
					},
				}

				chat.add({ role: "user", content: packedPrompt })
				usage.inputTokens = chat.getTokensCount()
				const { stream, result } = startStreaming(ai, modelId, chat, options)

				for await (const part of stream) {
					if ("string" === typeof part || "text-delta" == part.type) {
						fullResponse += part.text ?? part
					} else if ("usage" == part.type) {
						usage = part.usage
					}
				}
				// Persist real data
			} else {
				// TestAI mode: load from files instantly
				chat.add({ role: "user", content: packedPrompt })
				usage.inputTokens = chat.getTokensCount()
				const result = await ai.streamText(modelId, chat.messages, { cwd: chat.dir })
				fullResponse = result.fullResponse
				reasoning = result.reasoning
				usage = result.usage
				chunks = result.chunks
				await chatDb.save("chunks.json", chunks)
				await chatDb.save("stream.json", []) // Simplified
			}

			// Persist response only if not already done in test
			if (!isTest) {
				await chatDb.save("response.json", {})
				await chatDb.save("chunks.json", chunks)
			}
			await chatDb.save("stream.md", "")
			await chatDb.save("unknown.json", [])
			await chatDb.save("reason.md", reasoning)
		} catch (err) {
			console.error(`❌ Fatal error in llimo-chat (AI):`, err.stack ?? err.message)
			process.exit(1)
		} finally {
			clearInterval(chatting)
		}

		// Progress after streaming
		formatChatProgress({
			elapsed: (Date.now() - startTime) / 1e3,
			usage,
			clock,
			model: ai.getModel(modelId) || {},
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

		// Remaining logic...
		const testsCode = await decodeAnswerAndRunTests(chat, runCommand, isYes)
		const inputPrompt = await chat.db.load("prompt.md")
		packedPrompt = (await packPrompt(packMarkdown, inputPrompt, chat)).packedPrompt

		if (true === testsCode) {
			console.info(`  ${GREEN}+ Task is complete${RESET}`)
			await git.renameBranch(DONE_BRANCH)
			await git.push(DONE_BRANCH)
			break
		} else {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				await git.renameBranch(FAIL_BRANCH)
				break
			}
		}
		await git.commitAll(`step ${step}: response and test results`)
		step++
	}
}

async function runCommand(command, { cwd = process.cwd(), onData = () => {} }) {
	// Same as original
}

/* -------------------------------------------------------------------------- */

main().catch((err) => {
	console.error("❌ Fatal error in llimo-chat-test:", err.stack || err.message)
	process.exit(1)
})
