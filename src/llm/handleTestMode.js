import { formatChatProgress } from "./chatProgress.js"
import FileSystem from "../utils/FileSystem.js"
import { GREEN, RESET } from "../cli/ANSI.js"
import LanguageModelUsage from "./LanguageModelUsage.js"
import Ui from "../cli/Ui.js"
import Chat from "./Chat.js"
import ModelInfo from "./ModelInfo.js"
import { startStreaming } from "./chatSteps.js"
import AI from "./AI.js"

/**
 * Handles the test mode simulation for llmo-chat.
 * Extracted from the main script's if (testMode || testDir) block.
 *
 * @param {Object} options
 * @param {AI} options.ai - The TestAI instance.
 * @param {Ui} options.ui - UI instance for output.
 * @param {string} options.cwd - The chat directory for test files.
 * @param {string} options.input - The user input.
 * @param {Chat} options.chat - The chat instance.
 * @param {ModelInfo} options.model - Dummy model for progress.
 * @param {number} options.fps
 * @returns {Promise<void>}
 * @throws {Error} If simulation fails.
 */
export async function handleTestMode(options) {
	const {
		ai, ui, cwd, input, chat, model, fps
	} = options
	ui.console.info(`${GREEN}🔄 Simulating chat step using files from ${cwd}${RESET}`)
	const startTime = Date.now()
	const unknown = []
	let fullResponse = ""
	let reasoning = ""
	let usage = new LanguageModelUsage()
	let timeInfo
	const clock = { startTime, reasonTime: 0, answerTime: 0 }

	const format = new Intl.NumberFormat("en-US").format
	const valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format

	const chatting = setInterval(
		() => {
			const lines = formatChatProgress({
				elapsed: (Date.now() - startTime) / 1e3,
				usage,
				clock,
				model,
				format,
				valuta,
			})
			if (lines.length) {
				ui.cursorUp(lines.length)
				ui.overwriteLine(lines[lines.length - 1])
			}
		},
		1000 / fps
	)

	const chatDb = new FileSystem({ cwd: cwd })
	try {
		const chunks = []
		const options = {
			cwd: cwd,
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

		ui.console.debug(timeInfo)

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
		ui.console.info(`${GREEN}✅ Test simulation complete${RESET}`)
		process.exit(0)
	} catch (/** @type {any} */ err) {
		ui.console.error(`❌ Test mode error:`, err.stack ?? err.message)
		process.exit(1)
	} finally {
		clearInterval(chatting)
	}
}
