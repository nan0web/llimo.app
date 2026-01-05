import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import * as chatSteps from "./chatSteps.js"
import FileSystem from "../utils/FileSystem.js"
import Chat from "./Chat.js"
import Ui, { UiFormats } from "../cli/Ui.js"

/* -------------------------------------------------
	 Helper mocks
	 ------------------------------------------------- */
class DummyAI {
	streamText() {
		// mimic the shape used by `startStreaming`
		const asyncIter = (async function* () {
			yield { type: "text-delta", text: "Hello" }
			yield {
				type: "usage",
				usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
			}
		})()
		return { textStream: asyncIter }
	}
}

const mockUi = new Ui({ stdin: { isTTY: true } })
const mockRunCommand = async (cmd, options = {}) => {
	options.onData?.("mock output\n")
	return { stdout: "mock output", stderr: "", exitCode: 0 }
}

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
		assert.ok(inputFile.endsWith("test.txt"))
	})
})

describe("chatSteps – startStreaming", () => {
	it("returns a stream that yields expected parts", async () => {
		const ai = new DummyAI()
		const mockChat = { messages: [], add: () => { }, getTokensCount: () => 0 }
		const { stream } = chatSteps.startStreaming(
			ai,
			"model",
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
		/**
		 * @todo це має працювати по іншому, наприклад у мене є me.md, де Я пишу запити,
		 * їх потім потрібно разбити по блоках --- і зробити trim() і вже ці блоки
		 * перевіряти, чи є вони у попередніх повідомленнях.
		 * для кожної історії повідомлень у inputs.jsonl потрібно записувати всі user
		 * повідомлення, які були в чаті, так само як і files.jsonl куди потрібно
		 * записувати всі файли на кожне повідомлення, тобто повне логування кожного
		 * request/response щоб було легко перевіряти, яка інформація і файли змінились.
		 *
		 * Виправ помилки:
		 * ```bash
		 * pnpm test
		 * ...
		 * ```
		 *
		 * - [](src/**)
		 * - [](package.json)
		 *
		 * ---
		 *
		 * А тепер така помилка: File not found
		 */
		const fakePack = async ({ input }) => ({
			text: `<<${input}>>`,
			injected: ["a.js", "b.js"],
		})
		const {
			packedPrompt, injected
		} = await chatSteps.packPrompt(fakePack, "sample", chatInstance, mockUi)

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
		const mockUiMock = { console: { info: () => { } }, formats: new UiFormats() } // Mock to prevent output
		const { chat } = await chatSteps.initialiseChat({
			fs: fsInstance,
			ui: mockUiMock,
			isNew: true
		})

		assert.ok(chat.id)
		assert.ok(await fsInstance.exists("chat/current"))
		assert.strictEqual(chat.messages.length, 1) // System message
		assert.ok(chat.messages[0].content.includes("<!--TOOLS_LIST-->") === false)
	})
})
