import AI from "./AI.js"
import FileSystem from "../utils/FileSystem.js"

/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 *
 * In test mode, instead of calling real AI providers, it loads responses from:
 * - chunks.json: array of chunk objects for streaming simulation
 * - stream.json: array of stream events (falling back if chunks.json missing)
 * - messages.jsonl: overrides chat messages if present
 * - reason.md: reasoning content
 * - answer.md: full response content
 * - response.json: auxiliary data (ignored)
 * - stream.md: additional stream text (appended)
 * - tests.txt, todo.md, unknown.json: logged but not used for response
 * - me.md: ignored, as it's user input
 * - prompt.md: ignored, as prompt is already packed
 */
export default class TestAI extends AI {
	/**
	 * @param {object} input
	 * @param {Array<readonly [string, Partial<ModelInfo>]> | Map<string, Partial<ModelInfo>>} input.models
	 */
	constructor(input = {}) {
		super(input)
		this.addModel("test-model", {
			id: "test-model",
			name: "Test Model",
			provider: "test",
			pricing: { prompt: 0, completion: 0, input_cache_read: 0, input_cache_write: 0 },
			architecture: { modality: "text", input_modalities: ["text"], output_modalities: ["text"] },
			context_length: 1e6,
		})
	}

	/**
	 * Simulates streaming by reading chunks from files and yielding them with delays.
	 * Loads chat state from files if available.
	 * @param {string} modelId - Must be "test-model"
	 * @param {import('ai').ModelMessage[]} messages - Current chat messages
	 * @param {object} options - Streaming options
	 * @param {string} options.cwd - Chat directory (where files are located)
	 * @returns {Promise<{ fullResponse: string, reasoning: string, usage: import("../llm/AI.js").Usage, chunks: any[], stream: AsyncIterable<any> }>}
	 */
	async streamText(modelId, messages, options = {}) {
		if (modelId !== "test-model") {
			throw new Error("TestAI only supports 'test-model'")
		}

		const { cwd } = options
		const fs = new FileSystem({ cwd })
		let chunks = []
		let streamEvents = []
		let fullResponse = ""
		let reasoning = ""

		// Load chunks.json or fall back to stream.json
		try {
			const chunksData = await fs.load("chunks.json")
			chunks = Array.isArray(chunksData) ? chunksData : []
		} catch {
			try {
				const streamData = await fs.load("stream.json")
				streamEvents = Array.isArray(streamData) ? streamData : []
				chunks = streamEvents.map(ev => ev.chunk || ev) // Convert events to chunks
			} catch {
				console.warn("No chunks.json or stream.json found, simulating empty response")
				chunks = []
			}
		}

		// Load overridden messages if present
		let overriddenMessages = messages
		try {
			const messagesData = await fs.load("messages.jsonl")
			if (Array.isArray(messagesData)) {
				overriddenMessages = messagesData
			}
		} catch {}

		// Load reasoning from reason.md
		try {
			reasoning = await fs.load("reason.md") || ""
		} catch {}

		// Load full response from answer.md, or build from chunks
		try {
			const answer = await fs.load("answer.md")
			if (answer) fullResponse = String(answer)
		} catch {
			fullResponse = chunks.filter(c => c.type === "text-delta").map(c => c.text || "").join("")
		}

		// Append stream.md content
		try {
			const streamMd = await fs.load("stream.md")
			fullResponse += String(streamMd || "")
		} catch {}

		// Load usage from hypothetical response.json or estimate
		let usage = { inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0 }
		try {
			const responseData = await fs.load("response.json")
			if (responseData && responseData.usage) {
				usage = responseData.usage
			}
		} catch {
			usage.inputTokens = overriddenMessages.reduce((acc, msg) => acc + (msg.content.length / 4), 0)
			usage.reasoningTokens = reasoning.split(/\s+/).length
			usage.outputTokens = fullResponse.split(/\s+/).length
			usage.totalTokens = usage.inputTokens + usage.reasoningTokens + usage.outputTokens
		}

		// Log other files for debugging
		try {
			const tests = await fs.load("tests.txt")
			console.debug("Tests from tests.txt:", tests)
		} catch {}
		try {
			const todo = await fs.load("todo.md")
			console.debug("Todo from todo.md:", todo)
		} catch {}
		try {
			const unknown = await fs.load("unknown.json")
			console.debug("Unknown data:", unknown)
		} catch {}

		// Create async iterator for streaming simulation
		async function* createStream() {
			for (const chunk of chunks) {
				if (chunk.type === "text-delta" || typeof chunk === "string") {
					await new Promise(resolve => setTimeout(resolve, 10)) // Simulate delay
					if (options.onChunk) options.onChunk({ chunk })
				}
				if ("function" === typeof chunk.part) yield chunk.part // From stream.json format
				else yield chunk
			}
			// Yield usage at end
			if (options.onChunk) options.onChunk({ type: "usage", usage })
			yield { type: "usage", usage }
		}

		return {
			fullResponse,
			reasoning,
			usage,
			chunks,
			stream: createStream(),
		}
	}

	/**
	 * Non-streaming version (for completeness, just returns full response).
	 */
	async generateText(modelId, messages, options = {}) {
		const result = await this.streamText(modelId, messages, options)
		await Array.fromAsync(result.stream) // Consume stream
		return { text: result.fullResponse, usage: result.usage }
	}
}
