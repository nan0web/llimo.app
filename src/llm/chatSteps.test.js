import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import * as chatSteps from "./chatSteps.js"
import FileSystem from "../utils/FileSystem.js"
import Chat from "./Chat.js"

/* -------------------------------------------------
   Helper mocks
   ------------------------------------------------- */
class DummyAI {
	/** @type {Array} */
	constructor() {}
	streamText() {
		// mimic the shape used by `startStreaming`
		const asyncIter = (async function* () {
			yield { type: "text-delta", textDelta: "Hello" }
			yield {
				type: "usage",
				usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
			}
		})()
		return { textStream: asyncIter }
	}
}

/* -------------------------------------------------
   Tests
   ------------------------------------------------- */
describe("chatSteps – readInput", () => {
	/** @type {string} */
	let tempDir
	/** @type {FileSystem} */
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
		const stdin = { isTTY: true }
		const { input, inputFile } = await chatSteps.readInput(
			["test.txt"],
			fsInstance,
			stdin,
		)
		assert.equal(input, "file content")
		// inputFile should resolve to the temporary location
		assert.ok(inputFile.endsWith("test.txt"))
	})
})

describe("chatSteps – startStreaming", () => {
	it("returns a stream that yields expected parts", async () => {
		const ai = new DummyAI()
		const { stream } = chatSteps.startStreaming(
			ai,
			"model",
			"prompt",
			[]
		)
		const parts = []
		for await (const p of stream) parts.push(p)
		assert.deepEqual(parts, [
			{ type: "text-delta", textDelta: "Hello" },
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
		const { chat } = await chatSteps.initialiseChat(Chat, fsInstance)
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
		const { packedPrompt, injected, promptPath, stats } =
			await chatSteps.packPrompt(fakePack, "sample", chatInstance)

		assert.equal(packedPrompt, "<<sample>>")
		assert.deepEqual(injected, ["a.js", "b.js"])
		// prompt should be stored under the chat directory
		assert.ok(promptPath.startsWith(chatInstance.dir))
		assert.equal(stats.size, (await fsInstance.stat(promptPath)).size)
	})
})

