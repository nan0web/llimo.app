import LanguageModelUsage from "./LanguageModelUsage.js"
import { formatChatProgress } from "./chatProgress.js"
import { startStreaming, decodeAnswerAndRunTests } from "./chatSteps.js"
import { Git, FileSystem, Path } from "../utils/index.js"
import { GREEN, RESET, RED, YELLOW } from "../cli/ANSI.js"
import AI from "./AI.js"
import Chat from "./Chat.js"
import Ui from "../cli/Ui.js"
import ModelInfo from "./ModelInfo.js"
import { runCommand } from "../cli/runCommand.js"


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
 * @typedef {Object} sendAndStreamOptions
 * @property {string} answer
 * @property {string} reason
 * @property {LanguageModelUsage} usage
 * @property {any[]} unknown
 * @property {any} [error]
 */

/**
 * Executes the send and stream part of the chat loop.
 * @param {Object} options
 * @param {AI} [options.ai]
 * @param {Chat} options.chat
 * @param {Ui} options.ui
 * @param {string} options.prompt
 * @param {number} options.step
 * @param {(n: number) => string} options.format
 * @param {(n: number) => string} options.valuta
 * @param {ModelInfo} options.model
 * @param {number} [options.fps=30]
 * @returns {Promise<sendAndStreamOptions>}
 */
export async function sendAndStream(options) {
	const {
		ai = new AI(),
		chat,
		ui,
		step,
		prompt,
		format, valuta, model, fps = 30,
	} = options
	const startTime = Date.now()
	const unknown = []
	let answer = ""
	let reason = ""
	let prev = 0
	let usage = new LanguageModelUsage()
	let timeInfo
	const clock = { startTime, reasonTime: 0, answerTime: 0 }

	const chatting = ui.createProgress(({ elapsed }) => {
		const lines = formatChatProgress({ elapsed, usage, clock, model, format, valuta })
		if (prev) ui.cursorUp(prev)
		prev = lines.length
		lines.forEach((line) => ui.overwriteLine(line + "\n"))
	}, fps)

	const chatDb = new FileSystem({ cwd: chat.dir })
	let error
	try {
		const chunks = []
		const streamOptions = {
			onChunk: (el) => {
				const chunk = el.chunk
				const words = String(chunk.text || "").split(/\s+/)
				if ("reasoning-delta" === chunk.type) {
					reason += chunk.text
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

		chat.add({ role: "user", content: prompt })

		usage.inputTokens = chat.getTokensCount()

		const { stream, result } = startStreaming(ai, model.id, chat, streamOptions)

		const stepPrefix = `step${step}-`
		await chatDb.save(`${stepPrefix}stream.md`, "")
		const parts = []
		for await (const part of stream) {
			if ("string" === typeof part || "text-delta" == part.type) {
				answer += part.text ?? part
				await chatDb.append(`${stepPrefix}stream.md`, part.text ?? part)
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
		await chatDb.save(`${stepPrefix}response.json`, result)
		await chatDb.save(`${stepPrefix}stream.json`, parts)
		await chatDb.save(`${stepPrefix}chunks.json`, chunks)
		await chatDb.save(`${stepPrefix}unknown.json`, unknown)
		await chatDb.save(`${stepPrefix}reason.md`, reason)
		await chat.saveAnswer(answer, step)

		clearInterval(chatting)

		formatChatProgress({
			elapsed: (Date.now() - startTime) / 1e3,
			usage,
			clock,
			model,
			format,
		})
		if (timeInfo) {
			ui.console.info(timeInfo)
		}

		return { answer, reason, usage, unknown }
	} catch (/** @type {any} */ err) {
		clearInterval(chatting)
		// Graceful API error handling
		let shortMsg = "Unknown API error"
		if (["AI_APICallError", "APICallError", "RetryError"].includes(err.name)) {
			shortMsg = err.message.split("\n")[0] || shortMsg
			ui.console.error(`${RED}API Error: ${shortMsg}${RESET}`)
			if (isWindowLimit(err)) {
				ui.console.warn(`${YELLOW}Message is too long - choose another model${RESET}`)
				// @todo select another model
				throw err // Continue or handle
			}
			if (isRateLimit(err)) {
				ui.console.warn(`${YELLOW}⚠️ Rate limit reached – waiting before retry${RESET}`)
				await new Promise((r) => setTimeout(r, 6e3))
				throw err // Retry logic in caller
			}
			answer = `AI API failed: ${shortMsg}`
			usage.outputTokens = answer.split(/\s+/).length || 0
		} else {
			throw err
		}
		return { answer, reason, usage, unknown, error: err }
	} finally {
		clearInterval(chatting)
	}
}

/**
 * Handles post-stream processing: add to chat, save, unpack and test.
 * @param {Object} input
 * @param {Chat} input.chat
 * @param {Ui} input.ui
 * @param {string} input.answer
 * @param {string} input.reason
 * @param {number} input.step
 * @param {boolean} [input.isYes=false]
 * @returns {Promise<{shouldContinue: boolean, testsCode: string | boolean}>}
 */
export async function postStreamProcess(input) {
	const {
		chat, ui, answer, reason, step, isYes = false,
	} = input
	chat.add({ role: "assistant", content: answer })
	await chat.save()
	ui.console.info("")
	const path = new Path()
	const git = new Git({ dry: true })
	if (reason) {
		ui.console.info(`+ reason-step${step}.md (${path.resolve(chat.dir, `reason-step${step}.md`)})`)
	}
	ui.console.info(`+ answer-step${step}.md (${path.resolve(chat.dir, `answer-step${step}.md`)})`)

	// 6. decode answer & run tests
	const onData = (d) => ui.write(String(d))
	const { testsCode, shouldContinue } = await decodeAnswerAndRunTests(
		ui,
		chat,
		async (cmd, args, opts = {}) => runCommand(cmd, args, { ...opts, onData }),
		isYes,
		step
	)
	if (!shouldContinue) {
		return { shouldContinue: false, testsCode }
	}

	// 7. check if tests passed – same logic as original script
	if (true === testsCode) {
		// Task is complete, let's commit and exit
		ui.console.info(`  ${GREEN}+ Task is complete${RESET}`)
		const DONE_BRANCH = ""
		if (DONE_BRANCH) {
			await git.renameBranch(DONE_BRANCH)
			await git.push(DONE_BRANCH)
		}
		return { shouldContinue: false, testsCode: true }
	} else {
		let consecutiveErrors = 0 // Assume tracked in caller
		const MAX_ERRORS = 9
		consecutiveErrors++
		if (consecutiveErrors >= MAX_ERRORS) {
			ui.console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
			const FAIL_BRANCH = ""
			if (FAIL_BRANCH) {
				await git.renameBranch(FAIL_BRANCH)
			}
			return { shouldContinue: false, testsCode: false }
		}
	}

	// 8. commit step and continue
	// await git.commitAll(`step ${step}: response and test results`)
	return { shouldContinue: true, testsCode }
}
