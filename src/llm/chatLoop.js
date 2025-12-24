import { formatChatProgress } from "./chatProgress.js"
import { startStreaming, decodeAnswerAndRunTests } from "./chatSteps.js"
import { Git } from "../utils/Git.js"
import { GREEN, RESET, RED, YELLOW } from "../cli/ANSI.js"
import AI from "./AI.js"
import Chat from "./Chat.js"
import Ui from "../cli/Ui.js"
import ModelInfo from "./ModelInfo.js"
import { runCommand } from "../cli/runCommand.js"
import Usage from "./Usage.js"

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
 * @property {Usage} usage
 * @property {any[]} unknowns
 * @property {any} [error]
 */

/**
 * Executes the send and stream part of the chat loop.
 * @param {Object} options
 * @param {AI} options.ai
 * @param {Chat} options.chat
 * @param {Ui} options.ui
 * @param {string} options.prompt
 * @param {number} options.step
 * @param {(n: number) => string} options.format
 * @param {(n: number) => string} options.valuta
 * @param {ModelInfo} options.model
 * @param {boolean} [options.isTiny=false] - If true, use one-line progress mode
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
		format, model, fps = 30, isTiny = false
	} = options
	const startTime = Date.now()
	/** @type {Array<[string, any]>} */
	const unknowns = []
	let answer = ""
	let reason = ""
	let prevLines = 0 // Track previous number of lines printed
	const clock = { startTime, reasonTime: 0, answerTime: 0 }

	let usage = new Usage()
	const recent = chat.steps[chat.steps.length - 1]
	if (recent) {
		usage.inputTokens += recent.usage.inputTokens
	}

	const chatting = ui.createProgress(({ elapsed }) => {
		const lines = formatChatProgress({
			ui,
			usage,
			clock,
			model,
			isTiny
		})
		if (prevLines > 0) {
			ui.cursorUp(prevLines)
		}
		for (let i = 0; i < lines.length; i++) {
			ui.write(lines[i] + (i < lines.length - 1 ? '\n' : ''))
		}
		prevLines = lines.length
	}, fps)

	let timeInfo
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
					if (!clock.reasonTime) clock.reasonTime = Date.now()
				} else if ("text-delta" === chunk.type) {
					usage.outputTokens += words.length
					if (!clock.answerTime) clock.answerTime = Date.now()
				} else if ("raw" === chunk.type) {
					timeInfo = chunk.rawValue?.time_info
				} else {
					unknowns.push(["Unknown chunk.type", chunk])
				}
				chunks.push(chunk)
			},
			onError: (data) => {
				error = data.error
			},
		}

		chat.add({ role: "user", content: prompt })
		await chat.save()

		usage.inputTokens = chat.getTokensCount()

		const { stream, result } = startStreaming(ai, model, chat, streamOptions)

		await chat.append("stream", "", step)
		/** @type {object[]} */
		const parts = []
		for await (const part of stream) {
			if ("string" === typeof part || "text-delta" == part.type) {
				answer += part.text ?? part
				await chat.append("stream", part.text ?? part, step)
			} else if ("usage" == part.type) {
				usage = new Usage(part.usage)
			}
			parts.push(part)
		}
		await chat.save("parts", parts, step)
		if (error) throw error

		if ("resolved" === result._totalUsage?.status?.type) {
			usage = new Usage(result._totalUsage.status.value)
		} else {
			unknowns.push(["Unknowns _totalUsage.status type", result._totalUsage?.status?.type])
		}
		await chat.save("usage", usage, step)
		if (result._steps?.status?.type === "resolved") {
			const step0 = result._steps.status.value?.[0]
			if (step0?.usage) usage = new Usage(step0.usage)
			// keep header‑rate‑limit information for future use
			if (step0?.response?.headers) {
				const limits = Object.entries(step0.response.headers).filter(([k]) =>
					k.startsWith("x-ratelimit-")
				)
				// @todo future: apply limits to show them in the progress table.
			}
		} else {
			unknowns.push(["Unknowns _steps.status type", result._steps?.status?.type])
		}

		// persist raw result for debugging
		await chat.save({ response: result, parts, chunks: chunks, unknowns, reason, answer, usage, step })

		// After streaming finished, ensure we're on a new line
		ui.console.info("")

		clearInterval(chatting)

		formatChatProgress({
			ui,
			usage,
			clock,
			model,
			isTiny
		})
		if (timeInfo) {
			ui.console.info(timeInfo)
		}

		return { answer, reason, usage, unknowns }
	} catch (/** @type {any} */ err) {
		clearInterval(chatting)

		// Graceful API error handling
		let shortMsg = "Unknowns API error"
		if (["AI_RetryError"].includes(err.name)) {
			const errors = Array.from(err.errors ?? [])
			let retryAfter = 0
			for (const e of errors) {
				if (429 === e.statusCode) {
					const date = new Date(e.responseHeaders?.date)
					ui.console.error(`${date.toISOString()}: ${e.message}`)
					if (e.responseHeaders?.['retry-after']) {
						const after = parseInt(e.responseHeaders['retry-after'])
						retryAfter = Math.max(date.getTime() + after * 1e3, retryAfter)
					}
					ui.console.debug(e.stack)
				}
			}
			ui.console.warn(`  Retry after ${new Date(retryAfter).toISOString()}`)
		}
		else if (["AI_APICallError", "APICallError", "RetryError"].includes(err.name)) {
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
		return { answer, reason, usage, unknowns, error: err }
	} finally {
		// Ensure cleanup even on errors
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
	const git = new Git({ dry: true })
	if (reason) {
		ui.console.info(`+ reason (${chat.path("reason.md", step)})`)
	}
	ui.console.info(`+ answer (${chat.path("answer.md", step)})`)
	ui.console.info("") // Extra newline to avoid overlap

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
			// @todo write fail log
			return { shouldContinue: false, testsCode }
		}
	}

	// 8. commit step and continue
	// await git.commitAll(`step ${step}: response and test results`)
	return { shouldContinue: true, testsCode }
}

