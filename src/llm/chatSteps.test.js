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
			packedPrompt, injected, promptPath
		} = await chatSteps.packPrompt(fakePack, "sample", chatInstance, mockUi)

		assert.equal(packedPrompt, "<<sample>>")
		assert.deepEqual(injected, ["a.js", "b.js"])
		// prompt should be stored under the chat directory
		assert.ok(promptPath.startsWith(chatInstance.dir))
	})
})

describe("chatSteps – decodeAnswerAndRunTests (mocked)", () => {
	it("handles test output parsing", async () => {
		const mockChat = {
			db: new FileSystem(),
			messages: [{ role: "assistant", content: "test" }]
		}
		const mockUiMock = {
			...mockUi,
			askYesNo: async () => "yes"
		}
		const result = await chatSteps.decodeAnswerAndRunTests(mockUiMock, mockChat, mockRunCommand, true)
		assert.ok(result.testsCode !== undefined)
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

describe("chatSteps - parseOutput", () => {
	it("should parse two tests", () => {
		const stdout = [
			"ℹ tests 9",
			"ℹ suites 1",
			"ℹ pass 7",
			"ℹ fail 2",
			"ℹ cancelled 0",
			"ℹ skipped 0",
			"ℹ todo 0",
			"ℹ duration_ms 333",
			"# tests 3",
			"# suites 1",
			"# pass 0",
			"# fail 0",
			"# cancelled 1",
			"# skipped 1",
			"# todo 1",
			"# duration_ms 33.333",
		].join("\n")
		const stderr = [
			"src/CLiMessage.js(1,23): error TS2307: Cannot find module './ui/Message.js' or its corresponding type declarations.",
			"src/InputAdapter.js(380,13): error TS2339: Property 'output' does not exist on type 'UiMessage'.",
			"src/CLiMessage.js:1:23 - error TS2307: Cannot find module './ui/Message.js' or its corresponding type declarations.",
			"",
			"1 import UiMessage from \"./ui/Message.js\"",
			"                        ~~~~~~~~~~~~~~~~~",
			"",
			"src/InputAdapter.js:380:13 - error TS2339: Property 'output' does not exist on type 'UiMessage'.",
			"",
			"380     if (msg.output) {",
			"                ~~~~~~",
			"",
			"Found 4 errors in 3 files.",
			"",
			"Errors  Files",
			"     1  src/CLiMessage.js:1",
			"     2  src/InputAdapter.js:380",
			"     1  src/ui/Adapter.js:1",
			" ELIFECYCLE  Command failed with exit code 2.",
		].join("\n")
		const obj = {}
		const parsed = chatSteps.parseOutput(stdout, stderr)
		assert.deepStrictEqual(parsed.counts, {
			fail: 2, pass: 7, cancelled: 1, skip: 1, todo: 1, duration: 366.333, types: 2,
			tests: 12, suites: 2,
		})
		assert.equal(parsed.logs.fail.length, 2)
		assert.equal(parsed.logs.pass.length, 2)
		assert.equal(parsed.logs.cancelled.length, 2)
		assert.equal(parsed.logs.skip.length, 2)
		assert.equal(parsed.logs.todo.length, 2)
		assert.equal(parsed.logs.duration.length, 2)
		assert.equal(parsed.logs.types.length, 2)
		assert.equal(parsed.logs.tests.length, 2)
		assert.equal(parsed.logs.suites.length, 2)
	})
})
