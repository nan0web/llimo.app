import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { Chat } from "./Chat.js"

describe("Chat – message persistence", () => {
	let tempDir

	before(async () => {
		tempDir = await mkdtemp(resolve(tmpdir(), "llimo-chat-test-"))
	})

	after(async () => {
		if (tempDir) await rm(tempDir, { recursive: true, force: true })
	})

	it("loads messages from messages.jsonl", async () => {
		const messages = [
			{ role: "system", content: "You are AI." },
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
			{ role: "user", content: "How are you?" },
			{ role: "assistant", content: "Good, thanks." }
		]
		const chat = new Chat({ id: "test", cwd: tempDir, root: "chat" })
		await chat.init()
		await chat.db.save("messages.jsonl", messages)

		const loadedChat = new Chat({ id: "test", cwd: tempDir, root: "chat" })
		await loadedChat.load()

		assert.strictEqual(loadedChat.messages.length, 5)
		assert.strictEqual(loadedChat.messages[0].role, "system")
		assert.strictEqual(loadedChat.messages[1].content, "Hello")
		assert.strictEqual(loadedChat.messages[3].role, "user")
		assert.strictEqual(loadedChat.messages[4].content, "Good, thanks.")
	})

	it("handles empty or non-existent messages.jsonl", async () => {
		const chat = new Chat({ id: "test-empty", cwd: tempDir, root: "chat" })
		await chat.load()
		assert.strictEqual(chat.messages.length, 0)
	})

	it("saves and loads messages correctly", async () => {
		const chat = new Chat({ id: "test-save", cwd: tempDir, root: "chat" })
		chat.add({ role: "user", content: "Test message" })
		await chat.save()

		// New instance to test loading
		const loadedChat = new Chat({ id: "test-save", cwd: tempDir, root: "chat" })
		await loadedChat.load()
		assert.strictEqual(loadedChat.messages.length, 1)
		assert.strictEqual(loadedChat.messages[0].content, "Test message")
	})
})
