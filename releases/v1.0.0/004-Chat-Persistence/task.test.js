import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("004-Chat-Persistence – src/llm/Chat.js", () => {
	let tempDir
	before(async () => { tempDir = await mkdtemp(resolve(tmpdir(), "chat-test-")) })
	after(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

	describe("4.1 Chat save/load messages.jsonl", () => {
		it("persists and loads messages", async () => {
			const chatPath = resolve(rootDir, "src/llm/Chat.js")
			const { default: Chat } = await import(`file://${chatPath}`)
			const chat = new Chat({ id: "test-chat", cwd: tempDir, root: "chat" })
			await chat.init()
			chat.add({ role: "user", content: "test" })
			await chat.save()

			const loaded = new Chat({ id: "test-chat", cwd: tempDir, root: "chat" })
			const success = await loaded.load()
			assert.strictEqual(success, true)
			assert.strictEqual(loaded.messages.length, 1)
			assert.strictEqual(loaded.messages[0].content, "test")
		})
	})
})
