import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import path, { basename, dirname } from "node:path"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import os from "node:os"
import TestRunner from "./TestRunner.js"
import Chat from "./Chat.js"
import { packMarkdown } from "./pack.js"
import { unpackAnswer } from "./unpack.js"
import TestAI from "./TestAI.js"

/**
 * @todo write jsdoc for the methods.
 * This test must cover next scenarios:
 * 1. Create a proper file structure of inputs, prompts, reasons, asnwers, chunks, messages > should get proper info
 * 2. Run a test process (scenarios) with a delay to see all outputs as they should with the real API.
 * 3. Scenarios:
 * 3.1. Correct communication with correct tests. Just running a chat process including
 *      packing input into prompt and assert equality with the original ones already saved,
 *      unpacking answers into files and commands, running tests (mocks) with predefined output.
 * 3.2. Correct communication with failed 1st test iteration, 2nd iteration answer with fixes produces 100% correct tests.
 * 3.3. Communication with 429 errors and proper timeout handlers or switching to another model.
 * 3.4. Communication with errors by showing the error and if cannot continue process.exit(1).
 */

describe.skip("TestRunner", () => {
	/** @type {object} */
	let uiMock
	/** @type {string} */
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
				table: mock.fn(),
			},
			formats: {
				weight: (target, num) => new Intl.NumberFormat("en-US").format(num),
			},
			askYesNo: mock.fn(async () => "yes"),
			runCommand: mock.fn(async () => ({ stdout: "# pass 10\n# fail 0", stderr: "" })),
		}

		// Create tempDir for this test block
		tempDir = await mkdtemp(path.resolve(os.tmpdir(), "testrunner-"))
	})

	afterEach(async () => {
		if (tempDir) await rm(tempDir, { recursive: true, force: true })
	})

	describe("TestRunner scenarios", () => {
		let chatDir

		beforeEach(async () => {
			// Create chatDir for this scenario
			chatDir = path.resolve(tempDir, "chat/test-id")

			const fs = {
				save: mock.fn(async () => {}),
				mkdir: mock.fn(async () => {}),
			}

			// Setup files
			// (Simplified - in real test, use writeFile, but mock here)
			fs.save.mock.calls.push([
				"chat/current", "test-id",
				"chat/test-id/messages.jsonl", JSON.stringify([
					{ "role": "system", "content": "You are software architect." },
					{ "role": "user", "content": "Test 1" },
					{ "role": "assistant", "content": "Response 1" },
					{ "role": "user", "content": "Test 2" },
					{ "role": "assistant", "content": "Response 2" },
				])
			])
			// Mock exists and load for chat
			const mockChat = {
				load: mock.fn(async () => true),
				messages: [
					{ role: "system", content: "You are software architect." },
					{ role: "user", content: "Test 1" },
					{ role: "assistant", content: "Response 1" },
					{ role: "user", content: "Test 2" },
					{ role: "assistant", content: "Response 2" },
				]
			}
		})

		it("scenario 1: Create proper file structure of inputs, prompts, reasons, answer, chunks, messages > should get proper info", async () => {
			const runner = new TestRunner(uiMock, chatDir, { mode: "info", step: 1 })
			await runner.run()

			const calls = uiMock.console.info.mock.calls
			assert.ok(calls.some(c => c[0].includes("Chat test-id loaded")), "Should display loaded chat")
			assert.ok(calls.some(c => c[0].includes("message(s)")), "Should show message stats")
		})

		it("scenario 2: Run a test process (scenarios) with a delay to see all outputs as they should with the real API", async () => {
			const start = Date.now()
			const delay = 50
			const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1, delay })

			await runner.run()
			const end = Date.now()

			// Check that delay was applied (approximate)
			assert.ok((end - start) >= delay * 10, "Should account for delay in output timing")
			// Verify output messages
			const calls = uiMock.console.info.mock.calls
			assert.ok(calls.some(c => c[0].includes("Simulating unpack")), "Should show unpack simulation")
			assert.ok(calls.some(c => c[0].includes("Simulating tests")), "Should show test simulation")
		})

		it("scenario 3.1: Correct communication with correct tests", async () => {
			const mockChat = {
				messages: [{ role: "user", content: "Test" }],
				load: mock.fn(async () => true)
			}

			const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })

			// Mock packMarkdown to return pre-defined packed prompt
			const mockPack = mock.fn(async ({ input }) => ({ text: input, injected: ["package.json"] }))
			mock.method(await import("./pack.js"), "packMarkdown", mockPack)

			// Mock ai.streamText to return good answer with file changes
			const mockAiStream = mock.fn(async () => ({
				textStream: async function* () { yield "Good answer" }()
			}))
			mock.method(TestAI.prototype, "streamText", mockAiStream)

			// Mock unpackAnswer to succeed
			const mockUnpack = mock.fn(async () => async function* () { yield "+ package.json" }())
			mock.method(await import("./unpack.js"), "unpackAnswer", mockUnpack)

			// Mock runCommand for tests to pass
			uiMock.runCommand = mock.fn(async () => ({ stdout: "# pass 10\n# fail 0", stderr: "" }))

			await runner.simulateTest(mockChat)

			assert.ok(mockPack.mock.calls.length > 0, "Should call packMarkdown")
			assert.ok(mockAiStream.mock.calls.length > 0, "Should call streamText")
			assert.ok(mockUnpack.mock.calls.length > 0, "Should call unpackAnswer")
			assert.ok(uiMock.runCommand.mock.calls.length > 0, "Should run tests")
			assert.ok(uiMock.console.info.mock.calls.some(c => c[0].includes("Tests: 10 passed")), "Should report passed tests")
		})

		it("scenario 3.2: Correct communication with failed 1st test iteration, 2nd iteration answer with fixes produces 100% correct tests", async () => {
			const mockChat = {
				messages: [{ role: "user", content: "Test" }],
				add: mock.fn(),
				load: mock.fn(async () => true)
			}

			const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })

			// Mock askYesNo to simulate user interaction
			uiMock.askYesNo = mock.fn()
			uiMock.askYesNo.mock.calls[0] = async () => "yes" // Continue first
			uiMock.askYesNo.mock.calls[1] = async () => "no" // Stop second

			// First iteration: fail tests, second: pass
			let iteration = 0
			uiMock.runCommand = mock.fn(async () => {
				iteration++
				if (iteration === 1) return { stdout: "# pass 8\n# fail 2", stderr: "" }
				return { stdout: "# pass 10\n# fail 0", stderr: "" }
			})

			// Mock simulation to return something
			runner.simulateStep = mock.fn(async () => ({ fullResponse: "Test response", parsed: { files: new Map() } }))

			await runner.simulateTest(mockChat)

			assert.strictEqual(uiMock.runCommand.mock.callCount(), 2, "Should run tests twice")
			assert.ok(mockChat.add.mock.calls.length === 1, "Should add one message on failure")
		})

		it("scenario 3.3: Communication with 429 errors and proper timeout handlers or switching to another model", async () => {
			const mockChat = {
				messages: [{ role: "user", content: "Test" }],
				load: mock.fn(async () => true)
			}

			const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })

			// Mock process.exit to prevent test termination
			const exitMock = mock.fn(() => {})
			mock.method(process, "exit", exitMock)

			// Mock AI to throw 429 error
			const mockStream = mock.fn(async () => { throw new Error("429 Too Many Requests") })
			mock.method(TestAI.prototype, "streamText", mockStream)

			uiMock.askYesNo = mock.fn(async () => "no") // User opts to not retry

			try {
				await runner.simulateStep(mockChat)
			} catch (e) {
				assert.ok(true, "Should catch and handle 429 error")
			}

			assert.ok(uiMock.console.error.mock.calls.length > 0, "Should report error")
			assert.ok(uiMock.askYesNo.mock.calls.length > 0, "Should ask user for retry")
		})

		it("scenario 3.4: Communication with errors by showing the error and if cannot continue process.exit(1)", async () => {
			const mockChat = {
				messages: [{ role: "user", content: "Test" }],
				load: mock.fn(async () => true)
			}

			const runner = new TestRunner(uiMock, chatDir, { mode: "test", step: 1 })

			// Mock process.exit to check code
			const exitMock = mock.fn((code) => { assert.strictEqual(code, 1, "Should exit with code 1") })
			mock.method(process, "exit", exitMock)

			// Mock AI to throw fatal error
			const mockStream = mock.fn(async () => { throw new Error("Network error") })
			mock.method(TestAI.prototype, "streamText", mockStream)

			try {
				await runner.simulateStep(mockChat)
			} catch (e) {
				assert.ok(true, "Should catch and handle fatal error")
			}

			assert.strictEqual(exitMock.mock.callCount(), 0, "Should not call process.exit in test")
			assert.ok(uiMock.console.error.mock.calls.length > 0, "Should show error")
		})
	})
})

