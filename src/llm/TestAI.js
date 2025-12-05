import AI from "./AI.js"
import FileSystem from "../utils/FileSystem.js"
import LanguageModelUsage from "./LanguageModelUsage.js"
import ModelInfo from "./ModelInfo.js"
import MarkdownProtocol from "../utils/Markdown.js"

/**
 * TestAI extends AI to simulate chat responses using pre-recorded files from chat directory.
 *
 * In test mode, instead of calling real AI providers, it loads responses from:
 * - chunks.json: array of chunk objects for streaming simulation
 * - stream.json: array of stream events (falling back if chunks.json missing)
 * - messages.jsonl: overrides chat messages if present
 * - reason.md: reasoning content
 * - answer.md: full response content
 * - response.json: auxiliary data (usage, etc.)
 * - stream.md: additional stream text (appended)
 * - tests.txt: logged but not used for response (e.g., expected test outputs)
 * - todo.md: logged but not used for response (e.g., remaining tasks)
 * - unknown.json: logged but not used for response (e.g., unhandled data)
 * - me.md: ignored, as it's user input
 * - prompt.md: ignored, as prompt is already packed
 *
 * Supports per-step simulation by prefixing files with `step${options.step}-`
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
	 * Loads chat state from files if available. Handles all specified chat files.
	 * @param {string} modelId - Must be "test-model"
	 * @param {import('ai').ModelMessage[]} messages - Current chat messages
	 * @param {object} options - Streaming options
	 * @param {string} options.cwd - Chat directory (where files are located)
	 * @param {number} [options.step] - Step number for per-step files (e.g., chunks-step3.json)
	 * @param {number} [options.delay=10] - Delay in ms between chunks for simulation speed
	 * @returns {Promise<{ textStream: AsyncIterable<any>, fullResponse: string, reasoning: string, usage: LanguageModelUsage, chunks: any[] }>}
	 */
	async streamText(modelId, messages, options = {}) {
		if (modelId !== "test-model") {
			throw new Error("TestAI only supports 'test-model'")
		}

		const { cwd, step, delay = 10 } = options
		const fs = new FileSystem({ cwd })
		const stepPrefix = step ? `step${step}-` : ''
		let chunks = []
		let streamEvents = []
		let fullResponse = ""
		let reasoning = ""

		// Load chunks.json or fall back to stream.json
		try {
			const chunksData = await fs.load(`${stepPrefix}chunks.json`)
			chunks = Array.isArray(chunksData) ? chunksData : []
		} catch {
			try {
				const streamData = await fs.load(`${stepPrefix}stream.json`)
				streamEvents = Array.isArray(streamData) ? streamData : []
				chunks = streamEvents.map(ev => ev.chunk || ev) // Convert events to chunks
			} catch {
				console.warn(`No ${stepPrefix}chunks.json or ${stepPrefix}stream.json found, simulating empty response`)
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
		} catch {}

		// Load reasoning from reason.md
		try {
			reasoning = await fs.load(`${stepPrefix}reason.md`) || ""
		} catch {}

		// Load full response from answer.md, or build from chunks
		try {
			const answer = await fs.load(`${stepPrefix}answer.md`)
			if (answer) fullResponse = String(answer)
		} catch {
			fullResponse = chunks.filter(c => c.type === "text-delta").map(c => c.text || "").join("")
		}

		// Append stream.md content
		try {
			const streamMd = await fs.load(`${stepPrefix}stream.md`)
			fullResponse += String(streamMd || "")
		} catch {}

		// Load usage from response.json or estimate
		let usage = new LanguageModelUsage()
		try {
			const responseData = await fs.load(`${stepPrefix}response.json`)
			if (responseData && responseData.usage) {
				usage = new LanguageModelUsage(responseData.usage)
			}
		} catch {
			usage.inputTokens = Math.round(overriddenMessages.reduce((acc, msg) => acc + (String(msg.content).length / 4), 0))
			usage.reasoningTokens = reasoning.split(/\s+/).length
			usage.outputTokens = fullResponse.split(/\s+/).length
			usage.totalTokens = usage.inputTokens + usage.reasoningTokens + usage.outputTokens
		}

		// Log other files for debugging (tests.txt, todo.md, unknown.json)
		try {
			const tests = await fs.load(`${stepPrefix}tests.txt`)
			if (tests) console.debug("Tests from tests.txt:", tests)
		} catch {}
		try {
			const todo = await fs.load(`${stepPrefix}todo.md`)
			if (todo) console.debug("Todo from todo.md:", todo)
		} catch {}
		try {
			const unknownData = await fs.load(`${stepPrefix}unknown.json`)
			if (unknownData) console.debug("Unknown data:", unknownData)
		} catch {}

		// Ignore me.md and prompt.md as per spec

		// Create async iterator for streaming simulation
		async function* createStream() {
			for (const chunk of chunks) {
				if (chunk.type === "text-delta" || typeof chunk === "string") {
					await new Promise(resolve => setTimeout(resolve, delay)) // Simulate delay
					if (options.onChunk) options.onChunk({ chunk })
					yield chunk.text ?? chunk
				} else if ("function" === typeof chunk.part) {
					yield chunk.part() // From stream.json format
				} else {
					yield chunk
				}
			}
			// Yield usage at end
			if (options.onChunk) options.onChunk({ type: "usage", usage })
			yield { type: "usage", usage }
		}

		return {
			textStream: createStream(),
			fullResponse,
			reasoning,
			usage,
			chunks,
		}
	}

	/**
	 * Non-streaming version (for completeness, just returns full response).
	 */
	async generateText(modelId, messages, options = {}) {
		const result = await this.streamText(modelId, messages, options)
		await Array.fromAsync(result.textStream) // Consume stream
		return { text: result.fullResponse, usage: result.usage }
	}
}
