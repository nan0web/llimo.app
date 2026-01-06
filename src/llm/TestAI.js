/**
 * @typedef {import('ai').StreamTextResult<any, any>} StreamTextResult
 * @typedef {import('ai').ModelMessage} ModelMessage
 * @typedef {import('ai').UIMessageStreamOptions<import('ai').UIMessage>} UIMessageStreamOptions
 */

import { randomUUID } from "node:crypto"
import { AI } from "./AI.js"
import { FileSystem } from "../utils/FileSystem.js"
import { Usage } from "./Usage.js"
import { Chat } from "./Chat.js"

/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 */
export class TestAI extends AI {
	// @ts-ignore - Full mock method: ignores type constraints for simulation flexibility
	async streamText(model, messages, options = {}) {
		const { cwd = process.cwd(), step = 1, delay = 10 } = options
		const fs = new FileSystem({ cwd })
		const stepDir = `step/${String(step).padStart(3, '0')}/`
		let chunks = []
		let fullResponse = ""
		let reasoning = ""
		let usage = new Usage()

		try {
			chunks = Array.isArray(await fs.load(`${stepDir}chunks.jsonl`)) ? await fs.load(`${stepDir}chunks.jsonl`) : []
		} catch { }

		try {
			reasoning = String(await fs.load(`${stepDir}reason.md`) || "")
		} catch { }

		try {
			const answer = await fs.load(`${stepDir}answer.md`)
			if (answer !== null) fullResponse = String(answer)
		} catch { }

		try {
			const streamMd = await fs.load(`${stepDir}stream.md`)
			fullResponse += streamMd ? String(streamMd) : ""
		} catch { }

		try {
			const responseData = await fs.load(`${stepDir}response.json`)
			if (responseData && responseData.usage) {
				usage = new Usage(responseData.usage)
			}
		} catch {
			usage.inputTokens = Math.round(messages.reduce((acc, msg) => acc + (typeof msg.content === 'string' ? msg.content.length / 4 : 0), 0))
			usage.reasoningTokens = reasoning.split(/\s+/).length
			usage.outputTokens = fullResponse.split(/\s+/).length
		}

		if (chunks.length === 0) {
			chunks = fullResponse.split(/(\s+)/).filter(Boolean).map((text, i) => ({ type: "text-delta", text, id: `chunk-${step}-${i}` }))
		}

		const textStream = {
			[Symbol.asyncIterator]: async function* () {
				for (const chunk of chunks) {
					if (chunk?.type === "text-delta" || typeof chunk === "string") {
						await new Promise(r => setTimeout(r, delay))
						const textDelta = chunk?.text || chunk
						if (textDelta) yield textDelta
					}
				}
			}
		}

		const now = Date.now()
		const result = {
			id: randomUUID(),
			text: fullResponse,
			reasoning,
			content: fullResponse,
			reasoningText: reasoning,
			textStream,
			usage,
			rawCall: { messageId: randomUUID() },
			experimental_output: [],
			warnings: [],
			files: [],
			sources: [],
			toolCalls: [],
			toolResults: [],
			finishReason: "stop",
			stopReason: "stop",
			response: { id: `test-${now}`, timestamp: new Date(now), modelId: "test-model", headers: {}, messages: [] },
		}

		return result
	}

	/**
	 * Non-streaming version.
	 * @param {any} model
	 * @param {ModelMessage[]} messages
	 * @param {object} [options]
	 * @returns {Promise<{text: string, usage: Usage}>}
	 */
	async generateText(model, messages, options = {}) {
		const result = await this.streamText(model, messages, options)
		return { text: result.text, usage: result.usage }
	}
}
