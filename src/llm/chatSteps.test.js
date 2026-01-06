import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import * as chatSteps from "./chatSteps.js"
import { FileSystem } from "../utils/FileSystem.js"
import { Chat } from "./Chat.js"
import { Ui, UiFormats } from "../cli/Ui.js"
import { AI, ModelInfo } from "./index.js"

/* -------------------------------------------------
	 Helper mocks
	 ------------------------------------------------- */
class DummyAI extends AI {
	/**
	 * Stream text from a model.
	 *
	 * The method forwards the call to `ai.streamText` while providing a set of
	 * optional hooks that can be used by monitor or control the streaming
	 * lifecycle.
	 *
	 * @param {ModelInfo} model
	 * @param {import('ai').ModelMessage[]} messages
	 * @param {import('ai').UIMessageStreamOptions<import('ai').UIMessage> & import("./AI.js").StreamOptions} [options={}]
	 * @returns {import('ai').StreamTextResult<import('ai').ToolSet>}
	 */
	streamText(model, messages, options) {
		// mimic the shape used by `startStreaming`
		const asyncIter = (async function* () {
			yield { type: "text-delta", text: "Hello" }
			yield {
				type: "usage",
				usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
			}
		})()
		// Make result itself iterable (not textStream) so startStreaming uses result directly
		// @ts-expect-error - mock result for testing, making it iterable instead of providing textStream
		return Object.assign(asyncIter, {
			text: "Hello",
			content: "Hello",
			reasoning: undefined,
			reasoningText: undefined,
			usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
		})
	}
}

// @ts-ignore mock stdin in short way
const mockUi = new Ui({ stdin: { isTTY: true } })

/* -------------------------------------------------
	 Tests
	 ------------------------------------------------- */
describe("chatSteps – readInput", () => {
	let tempDir
	let fsInstance

	before(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chatSteps-"))
		fsInstance = new FileSystem({ cwd: tempDir })
		// create a temporary file with known content
		await fs.writeFile(path.join(tempDir, "test.txt"), "file content")
	})

	after(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("reads from argv when provided", async () => {
		const { input, inputFile } = await chatSteps.readInput(
			["test.txt"],
			fsInstance,
			mockUi,
		)
		assert.equal(input, "file content")
		// inputFile should resolve to the temporary location
		assert.ok(inputFile?.endsWith("test.txt"))
	})
})

describe("chatSteps – startStreaming", () => {
	it("returns a stream that yields expected parts", async () => {
		const ai = new DummyAI()
		const mockChat = new Chat()
		mockChat.messages = []
		mockChat.add = () => { }
		mockChat.getTokensCount = () => 0
		const { stream } = chatSteps.startStreaming(
			ai,
			new ModelInfo(),
			mockChat,
			{ onChunk: () => { } }
		)
		const parts = []
		for await (const p of stream) parts.push(p)
		assert.deepEqual(parts, [
			{ type: "text-delta", text: "Hello" },
			{
				type: "usage",
				usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
			},
		])
	})
})

describe("chatSteps – packPrompt (integration with mock)", () => {
	let tempDir
	let fsInstance
	let chatInstance

	before(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chatStepsPack-"))
		fsInstance = new FileSystem({ cwd: tempDir })
		// initialise a real Chat instance inside the temp dir
		const { chat } = await chatSteps.initialiseChat({
			ChatClass: Chat,
			fs: fsInstance,
			ui: mockUi,
			isNew: true
		})
		chatInstance = chat
	})

	after(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("packs prompt and writes file", async () => {
		const fakePack = async ({ input }) => ({
			text: `<<${input}>>`,
			injected: ["a.js", "b.js"],
		})
		const {
			packedPrompt, injected
		} = await chatSteps.packPrompt(fakePack, "sample", chatInstance)

		assert.equal(packedPrompt, "<<sample>>")
		assert.deepEqual(injected, ["a.js", "b.js"])
	})
})

describe("chatSteps – decodeAnswer (mocked)", () => {
	it.todo("should decode formatted llm response", async () => {
		assert.fail("mock the answer and decode it")
	})
})

describe("chatSteps – runTests (mocked)", () => {
	it.todo("should run sequence of tests", async () => {
		assert.fail("mock the answer and decode it")
	})
})

describe("chatSteps – initialiseChat", () => {
	let tempDir
	let fsInstance

	before(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-chat-"))
		fsInstance = new FileSystem({ cwd: tempDir })
	})

	after(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("creates new chat with system prompt", async () => {
		const mockUiMock = new Ui()
		mockUiMock.console.info = () => { }
		const { chat } = await chatSteps.initialiseChat({
			fs: fsInstance,
			ui: mockUiMock,
			isNew: true
		})

		assert.ok(chat.id)
		assert.ok(await fsInstance.exists("chat/current"))
		assert.strictEqual(chat.messages.length, 1) // System message
		const content = chat.messages[0].content
		assert.ok(typeof content === "string" && content.includes("\ntools: "))
	})
})
