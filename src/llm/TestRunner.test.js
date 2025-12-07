import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import TestRunner from "./TestRunner.js"
import Chat from "./Chat.js"

describe("TestRunner", () => {
	let uiMock
	let chatDir
	let tempDir

	beforeEach(async () => {
		// UI mock with console methods and a simple FS mock
		uiMock = {
			console: {
				debug: mock.fn(),
				info: mock.fn(),
				error: mock.fn(),
				warn: mock.fn(),
				style: mock.fn(),
			},
			// Minimal FileSystem‑like shape – methods are plain functions so we can replace them later
			fs: {
				readdir: mock.fn(async () => []),
				browse: mock.fn(async () => []),
				mkdir: mock.fn(async () => {}),
				load: mock.fn(async () => ""),   // will be overridden per test
				writeFile: mock.fn(async () => {}),
				exists: mock.fn(async () => false), // will be overridden per test
			},
		}

		// temporary chat directory with a tiny messages.jsonl
		tempDir = await mkdtemp(path.join(os.tmpdir(), "testrunner-"))
		chatDir = path.join(tempDir, "test-chat")
		await mkdir(chatDir, { recursive: true })

		await writeFile(
			path.join(chatDir, "messages.jsonl"),
			'{"role":"system","content":"You are AI."}\n{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi"}\n',
			"utf-8"
		)
	})

	afterEach(async () => {
		if (tempDir) await rm(tempDir, { recursive: true, force: true })
	})

	it("should display chat info correctly", async () => {
		const runner = new TestRunner(uiMock, chatDir, { mode: "info", step: 1 })
		const chat = new Chat({ id: path.basename(chatDir), dir: chatDir })
		await chat.load()
		await runner.showInfo(chat)

		assert.strictEqual(uiMock.console.info.mock.calls.length > 0, true)
		assert.ok(
			uiMock.console.info.mock.calls.some((c) => c.arguments[0].includes("Chat info for"))
		)
	})

	it("should warn if step exceeds history", async () => {
		const runner = new TestRunner(uiMock, chatDir, { mode: "info", step: 5 })
		const chat = new Chat({ id: path.basename(chatDir), dir: chatDir })
		await chat.load()
		await runner.showInfo(chat)

		assert.ok(
			uiMock.console.warn.mock.calls.some((c) => c.arguments[0].includes("exceeds history"))
		)
	})

	it("should simulate unpack without errors", async () => {
		const runner = new TestRunner(uiMock, chatDir, {
			mode: "unpack",
			step: 1,
			outputDir: path.join(chatDir, "unpack"),
		})
		const chat = new Chat({ id: path.basename(chatDir), dir: chatDir })
		await chat.load()

		const mockResponse = {
			fullResponse:
				"#### [test.js](test.js)\n```js\nconst x = 1;\n```\n#### [2 file(s), 0 command(s)](@validate)\n```markdown\n- [](test.js)\n```",
			parsed: {
				correct: [],
				failed: [],
				isValid: true,
				validate: null,
				files: new Map(),
				requested: new Map(),
			},
			simResult: { fullResponse: "", textStream: Promise.resolve() },
		}
		mock.method(runner, "simulateStep", async () => mockResponse)

		await runner.simulateUnpack(chat)

		assert.ok(
			uiMock.console.info.mock.calls.some((c) => c.arguments[0].includes("Unpack simulation complete"))
		)
	})

	it("should simulate test without errors", async () => {
		// make the FS mock return the desired test file content
		uiMock.fs.load = async (file) => {
			if (file === "test-step1.txt") return "# pass 10\n# fail 0"
			return ""
		}
		uiMock.fs.exists = async (file) => file === "test-step1.txt"

		const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })
		const chat = new Chat({ id: path.basename(chatDir), dir: chatDir })
		await chat.load()

		// mock the AI simulation – the content of the response does not matter for this test
		const mockSimResponse = {
			fullResponse: "mock",
			parsed: { files: new Map() },
		}
		mock.method(runner, "simulateStep", async () => mockSimResponse)

		await runner.simulateTest(chat)

		assert.ok(
			uiMock.console.info.mock.calls.some((c) => c.arguments[0].includes("Tests: 10 passed, 0 failed"))
		)
	})

	it("should throw error for invalid step", async () => {
		const runner = new TestRunner(uiMock, chatDir, { mode: "unpack", step: 10 })
		const chat = new Chat({ id: path.basename(chatDir), dir: chatDir })
		await chat.load()

		await assert.rejects(() => runner.simulateStep(chat), { message: "Invalid step 10" })
	})

	it("should handle test mode with temp directory copy", async () => {
		const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })
		mock.method(runner, "simulateTest", async () => {})

		await runner.run()
		assert.strictEqual(uiMock.console.error.mock.calls.length, 0)
	})
})
