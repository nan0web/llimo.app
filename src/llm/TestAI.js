/**
 * @typedef {import('ai').StreamTextResult<any, any>} StreamTextResult
 * @typedef {import('ai').ModelMessage} ModelMessage
 * @typedef {import('ai').UIMessageStreamOptions<import('ai').UIMessage<any, any, any>>} UIMessageStreamOptions
 */

import { randomUUID } from "node:crypto"
import { AI } from "./AI.js"
import { FileSystem } from "../utils/FileSystem.js"
import { Usage } from "./Usage.js"
import { Chat } from "./Chat.js"

/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 *
 * In test mode, instead of calling real AI providers, it loads responses from:
 * - steps/+/answer.md       full response content
 * - steps/+/chunks.jsonl    array of chunk objects for streaming simulation
 * - steps/+/input.md        input prompt (before agent injections)
 * - steps/+/model.json      model information
 * - steps/+/prompt.md       prompt message (after agent injections)
 * - steps/+/reason.md       reasoning content
 * - steps/+/response.json   auxiliary data (usage, etc.)
 * - steps/+/stream.jsonl    array of stream events (falling back if chunks.jsonl missing)
 * - steps/+/stream.md       additional stream text (appended)
 * - steps/+/tests.txt       logged but not used for response (e.g., expected test outputs)
 * - steps/+/tests.err       errors as text that should be sent to LLiMo
 * - steps/+/tests.json      Record<"fail" | "cancelled" | "types" | "skip" | "todo" | "pass" | "types", number>
 * - steps/+/time.json       { read: number, reason: number, answer: number, tests: number } spent time in ms
 * - steps/+/todo.md         logged but not used for response (e.g., remaining tasks) > TODO tests
 * - steps/+/unknown.jsonl   logged but not used for response (e.g., unhandled data)
 * - steps/+/usage.json      step usage info
 * - files.jsonl             injected files (references)
 * - messages.jsonl          Array<{ role: string, content: string }> like storage of the messages
 * - tests.txt               root tests - logged but not used for response (e.g., expected test outputs)
 * - tests.err               root tests - errors as text that should be sent to LLiMo
 * - tests.json              root tests - Record<"fail" | "cancelled" | "types" | "skip" | "todo" | "pass" | "types", number>
 *
 * Supports per-step simulation by prefixing files with `step${options.step}/`
 */
export class TestAI extends AI {
	/**
	 * Simulates streaming by reading chunks from files and yielding them with delays.
	 * Loads chat state from files if available. Handles all specified chat files.
	 * Updated to load me.md, split into blocks by ---, trim, filter new blocks not in previous user messages,
	 * but since it's test, use the full content as original (but simulate filtering if needed).
	 * @param {any} modelId
	 * @param {ModelMessage[]} messages
	 * @param {UIMessageStreamOptions & } [options={}]
	 * @returns {Promise<import('ai').StreamTextResult<import('ai').ToolSet>>}
	 */
	async streamText(modelId, messages, options = {}) {


		const { cwd = process.cwd(), step = 1, delay = 10, onChunk, onFinish, onError, onAbort } = options
		const fs = new FileSystem({ cwd })
		const stepDir = `step/${String(step).padStart(3, '0')}/`
		let chunks = []
		let streamEvents = []
		let fullResponse = ""
		let reasoning = ""
		let usage = new Usage()

		// Load chunks.jsonl or fall back to stream.json
		try {
			const chunksData = await fs.load(`${stepDir}chunks.jsonl`)
			chunks = Array.isArray(chunksData) ? chunksData : []
		} catch {
			try {
				const streamData = await fs.load(`${stepDir}stream.json`)
				streamEvents = Array.isArray(streamData) ? streamData : []
				chunks = streamEvents.map(ev => typeof ev === 'object' ? ev.chunk || ev : ev) // Convert events to chunks
			} catch {
				console.warn(`No ${stepDir}chunks.jsonl or ${stepDir}stream.json found, simulating empty response`)
				chunks = []
			}
		}

		// Load overridden messages if present (messages.jsonl)
		let overriddenMessages = messages
		try {
			const messagesData = await fs.load("messages.jsonl")
			if (Array.isArray(messagesData)) {
				overriddenMessages = messagesData
			}
		} catch { }

		// Load reasoning from reason.md
		try {
			reasoning = await fs.load(`${stepDir}reason.md`) || ""
		} catch { }

		// Load full response from answer.md, or build from chunks
		try {
			const answer = await fs.load(`${stepDir}answer.md`)
			if (answer) fullResponse = String(answer)
		} catch {
			fullResponse = chunks.filter(c => c?.type === "text-delta").reduce((acc, c) => acc + (c.text || ""), "")
		}

		// Append stream.md content
		try {
			const streamMd = await fs.load(`${stepDir}stream.md`)
			fullResponse += String(streamMd || "")
		} catch { }

		// Load usage from response.json or estimate
		try {
			const responseData = await fs.load(`${stepDir}response.json`)
			if (responseData && responseData.usage) {
				usage = new Usage(responseData.usage)
			}
		} catch {
			usage.inputTokens = Math.round(overriddenMessages.reduce((acc, msg) => acc + String(msg.content).length / 4, 0))
			usage.reasoningTokens = reasoning.split(/\s+/).length
			usage.outputTokens = fullResponse.split(/\s+/).length
			usage.totalTokens = usage.inputTokens + usage.reasoningTokens + usage.outputTokens
		}

		// If no chunks, simulate by splitting fullResponse
		if (chunks.length === 0) {
			const wordsWithSpaces = fullResponse.split(/(\s+)/).filter(Boolean)
			chunks = wordsWithSpaces.map((text, i) => ({ type: "text-delta", text, id: `chunk-${step}-${i}` }))
		}

		// Create async iterable for textStream (simplified to match ai/rsc)
		const textStream = createAsyncIterable(async function* () {
			for (const chunk of chunks) {
				if (chunk.type === "text-delta" || typeof chunk === "string") {
					await new Promise(r => setTimeout(r, delay))
					if (onChunk) onChunk({ chunk })
					const textDelta = typeof chunk === "string" ? chunk : chunk.text
					if (textDelta) yield textDelta
				} else if (chunk) {
					if (onChunk) onChunk({ chunk })
				}
			}
			if (onChunk) onChunk({ type: "usage", usage })
			yield { type: "usage", usage: usage } // End with usage
			if (onFinish) onFinish({ usage })
		})

		// Simulate full StreamTextResult structure
		const result = {
			id: randomUUID(),
			object: "thread.run",
			created_at: Math.floor(Date.now() / 1000),
			response: {
				headers: {
					'x-ratelimit-remaining-requests': '99',
					'x-ratelimit-remaining-tokens': '9999'
				}
			}, // Mock response for rate limits
			reasoning,
			fullResponse,
			usage,
			_totalUsage: { status: { type: "resolved", value: usage } },
			_steps: { status: { type: "resolved", value: [{ usage }] } },
			// Stub other required properties
			content: fullResponse,
			text: fullResponse,
			// reasoning,
			// reasoningText: reasoning,
		}

		return result
	}

	/**
	 * Non-streaming version (for completeness, just returns full response).
	 * @param {string} modelId
	 * @param {ModelMessage[]} messages
	 * @param {{cwd?: string, step?: number}} [options]
	 * @returns {Promise<{text: string, usage: Usage}>}
	 */
	async generateText(modelId, messages, options = {}) {
		const streamResult = await this.streamText(modelId, messages, options)
		// Consume the stream to get full text
		let fullText = ""
		for await (const chunk of streamResult.textStream) {
			if (typeof chunk === "string") fullText += chunk
			else if (chunk.text) fullText += chunk.text
		}
		return { text: fullText, usage: streamResult.usage }
	}

	/**
	 * Simulates the chat from the beginning till the end through all the steps.
	 * No files write/remove access, only reading and priting saved logs.
	 * No real tests execution, only reading and priting saved logs.
	 *
	 * Workflow
	 * 1. load current chat --chat-dir.
	 * 2. start the chat.
	 * 2.1. simulate root (0) tests if present.
	 * 2.2. simulate the input, prompt.
	 * 2.3. simulate the output with the same speed calculate from time.json, usage.json and tests.txt.
	 * 2.4. simulate unpack.
	 * 2.5. simulate tests.
	 * 3. complete the chat.
	 */
	async simulateChat() {
		const chat = new Chat()
	}

	/**
	 * Runs the chat loop.
	 *
	 * Workflow
	 * 1. load current chat --chat-dir or start new if --new.
	 * 2. start the chat.
	 * 2.1. Run tests if --fix provided.
	 * 2.2. Pack input > prompt.
	 * 2.3. Send chat messages to API.
	 * 2.4. Unpack the response.
	 * 2.5. Run tests.
	 * 2.6. Continue the chat if any test fail (exitCode !== 0).
	 * 3. complete the chat.
	 */
	async chat() {

	}

	async simulateRelease() {

	}
}
