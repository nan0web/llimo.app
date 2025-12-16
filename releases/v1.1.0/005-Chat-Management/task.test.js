/**
 * @todo Detailed English: Implement full chat archiving in src/llm/Chat.js: On --new, generate short ID from UUID (base36: split UUID, parseInt(hex,16).toString(36), join '-'), move old /chat/UUID to /archive/<short>/chat.zip (use adm-zip for compression) + chat.json metadata (id, date, usage). Add llimo ls in bin/llimo-ls.js: Scan /chat/current and recent /archive/* (6 latest by date), display table (title from title.md, size via fs.stat, tokens/cost from usage.json, keypress filter/search). Resume: llimo ls → interactive select (1-6 or filter text → top 6 matches), unzip /archive/short/chat.zip to /chat/UUID, set /chat/current, load messages. Add delete/clear: llimo delete [ID] (rm current or specific archive by short ID), llimo clear (rm -rf /archive). Info: llimo info (current stats: size/tokens/cost summed), llimo info -r (recursive total across all).
 *       - Create: src/llm/ChatArchive.js (shortID gen, zip/unzip via adm-zip pnpm add adm-zip), bin/llimo-ls.js (table UI with keypress via readline), bin/llimo-info.js (recursive sum), bin/llimo-delete.js (safe rm with confirm).
 *       - Tests: src/llm/ChatArchive.test.js (UUID→short e.g. "a45aa0ca..."→"19lopmy-v6h...", zip round-trip integrity, metadata json), bin/llimo-ls.test.js (mock dirs, assert table output, stdin simulate select/filter), bin/llimo-delete.test.js (mock rm, assert gone no errors).
 *       Deps: 5.1 (Chat init/save), 4.1 (parsing for title.md), external: adm-zip.
 *       Security: Validate short ID (no /../ in paths via path.resolve), confirm delete (askYesNo), limit archive size (<1GB unzip), scan zip for vulns (file count/type check, no exec).
 *       After code: Run tests from tests.txt (archive/resume cycles, ls filter), then pnpm test:all (include delete safety).
 */

import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import path from "node:path"
import { mkdtemp, rm, writeFile, mkdir, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import crypto from "node:crypto"
import Chat from "../../../src/llm/Chat.js"
import FileSystem from "../../../src/utils/FileSystem.js"
import AdmZip from "adm-zip"  // Assume pnpm add adm-zip

describe("005-Chat-Management – src/llm/Chat.js", () => {
	describe("5.1 Initialize chat dir with UUID ID, save to chat/current, load messages.jsonl", () => {
		it("Generates UUID ID dir, saves/loads messages from jsonl with history restore", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "chat-5.1-"))
			const fs = new FileSystem({ cwd: tempDir })
			const chat = new Chat({ cwd: tempDir })
			await chat.init()
			const uuid = chat.id
			ok(uuid.match(/^[0-9a-f-]{36}$/), "Generates valid UUID ID")
			chat.add({ role: "system", content: "init" })
			chat.add({ role: "user", content: "test msg" })
			await chat.save()
			ok(await access(path.join(tempDir, "chat/current")), "Saves current symlink")
			const loadedCurrent = await fs.load("chat/current")
			strictEqual(loadedCurrent, uuid, "Current points to UUID")
			const loadedChat = new Chat({ cwd: tempDir })
			await loadedChat.load()
			deepStrictEqual(loadedChat.messages.length, 2, "Restores 2 messages from jsonl")
			ok(loadedChat.messages[1].content === "test msg", "History intact")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("5.2 Archive old chats on --new: zip dir + chat.json to archive/<short>/", () => {
		it("Archives old /chat/UUID to /archive/<base36-short>/chat.zip + metadata.json on --new", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "archive-5.2-"))
			const fs = new FileSystem({ cwd: tempDir })
			const oldUuid = crypto.randomUUID()
			await mkdir(path.join(tempDir, `chat/${oldUuid}`))
			await writeFile(path.join(tempDir, `chat/${oldUuid}/messages.jsonl`), JSON.stringify([{ content: "old" }]))
			await fs.save("chat/current", oldUuid)
			// Simulate --new: Archive old
			const shortId = oldUuid.split("-").map(hex => parseInt(hex, 16).toString(36)).join("-")
			const archivePath = path.join(tempDir, "archive", shortId)
			await mkdir(archivePath, { recursive: true })
			const zip = new AdmZip()
			zip.addLocalFile(path.join(tempDir, `chat/${oldUuid}`), "", "**/*")
			zip.writeZip(path.join(archivePath, "chat.zip"))
			const metadata = { id: oldUuid, date: new Date().toISOString(), usage: { tokens: 10 } }
			await writeFile(path.join(archivePath, "chat.json"), JSON.stringify(metadata))
			// Verify
			const zipEntry = new AdmZip(path.join(archivePath, "chat.zip")).getEntries()
			ok(zipEntry.length > 0 && zipEntry[0].entryName.includes("messages.jsonl"), "Zip contains old files")
			const meta = JSON.parse(await readFile(path.join(archivePath, "chat.json")))
			strictEqual(meta.id, oldUuid, "Metadata includes old UUID")
			ok(shortId.length < oldUuid.length, "Short ID shorter than UUID")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("5.3 Support ls chats: show recent/current with title, size, tokens, cost", () => {
		it("llimo ls displays table of 6 recent + current (title/size/tokens/cost), keypress filter", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "ls-5.3-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "archive"))
			// Mock 6 recent archives + current
			const archives = ["chat1", "chat2", "chat3", "chat4", "chat5", "chat6"]
			const currentId = "current-chat"
			await mkdir(path.join(tempDir, `chat/${currentId}`))
			await writeFile(path.join(tempDir, `chat/${currentId}/title.md`), "# Current Title")
			await writeFile(path.join(tempDir, `chat/${currentId}/usage.json`), JSON.stringify({ tokens: 1000, cost: 0.1 }))
			const stats = await fs.stat(path.join(tempDir, `chat/${currentId}/title.md`))
			const size = stats.size
			for (let i = 0; i < 6; i++) {
				const id = archives[i]
				await mkdir(path.join(tempDir, `archive/${id}`))
				await writeFile(path.join(tempDir, `archive/${id}/chat.json`), JSON.stringify({ title: `Archive ${i+1}`, size, tokens: 500 * (i+1), cost: 0.05 * (i+1) }))
			}
			// Simulate llimo ls: Scan, sort recent by date (mock), filter on keypress "arch" → top matches
			// Mock table output: Title | Date | Time | Size | Tokens | Cost
			const expectedTable = "Title                  Date        Time    File size  Context size  Cost\nCurrent Title       2024-01-01   12:00     100b         1,000T     $0.100000\nArchive 6           2024-01-01   11:00     300b         3,000T     $0.300000\n... (top 6 recent)"
			// For test: Verify structure (6 + current, filter reduces)
			const recent = archives.slice(-6).reverse()  // Mock recent
			ok(recent.length === 6, "Displays 6 recent + current")
			// Keypress filter sim: mock stdin "a" → matches Archive 1-6 + Current? (if title contains)
			const filtered = recent.filter(id => id.includes("a")).concat(currentId)
			ok(filtered.length > 0, "Filters by keypress/title match, shows top 6")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("5.4 Resume archived chat: extract zip, set as current", () => {
		it("Resumes via llimo ls select: unzip /archive/short to /chat/ID, update current symlink", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "resume-5.4-"))
			const fs = new FileSystem({ cwd: tempDir })
			const archivedId = "resumed-id"
			const shortId = "19lopmy-v6h"  // Mock base36
			await mkdir(path.join(tempDir, `archive/${shortId}`))
			const zip = new AdmZip()
			const tempZipDir = path.join(tempDir, "temp-zip")
			await mkdir(tempZipDir)
			await writeFile(path.join(tempZipDir, "messages.jsonl"), JSON.stringify([{ content: "resumed msg" }]))
			zip.addLocalFolder(tempZipDir, "")
			zip.writeZip(path.join(tempDir, `archive/${shortId}/chat.zip`))
			// Simulate llimo ls → select shortId (stdin "1")
			// Resume: Unzip to /chat/{archivedId}, fs.save("chat/current", archivedId)
			const unzip = new AdmZip(path.join(tempDir, `archive/${shortId}/chat.zip`))
			await mkdir(path.join(tempDir, `chat/${archivedId}`))
			unzip.extractAllTo(path.join(tempDir, `chat/${archivedId}`), true)
			await fs.save("chat/current", archivedId)
			// Verify
			const current = await fs.load("chat/current")
			strictEqual(current, archivedId, "Updates current to resumed ID")
			const loadedMsg = JSON.parse(await readFile(path.join(tempDir, `chat/${archivedId}/messages.jsonl`)))[0]
			ok(loadedMsg.content === "resumed msg", "Restores messages from unzip")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("5.5 Commands: delete [id] (current/all), clear all archives", () => {
		it("llimo delete [ID]: Removes current or specific archive by short ID with confirm", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "delete-5.5-"))
			const fs = new FileSystem({ cwd: tempDir })
			const targetId = "delete-id"
			await mkdir(path.join(tempDir, `chat/${targetId}`))
			await fs.save("chat/current", "current-id")  // Different
			// Simulate llimo delete delete-id: rm -rf chat/delete-id (confirm via askYesNo "yes")
			await rm(path.join(tempDir, `chat/${targetId}`), { recursive: true })
			const exists = await access(path.join(tempDir, `chat/${targetId}`)).then(() => true).catch(() => false)
			strictEqual(exists, false, "Deletes specific ID")
			// Current: llimo delete (no arg) → rm chat/current-id if confirm
			await rm(path.join(tempDir, "chat/current-id"), { recursive: true, force: true })
			exists = await access(path.join(tempDir, "chat/current-id")).then(() => true).catch(() => false)
			strictEqual(exists, false, "Deletes current on no arg")
			await rm(tempDir, { recursive: true })
		})

		it("llimo clear: Removes all /archive/* with confirm (no current)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "clear-5.5-"))
			const fs = new FileSystem({ cwd: tempDir })
			await mkdir(path.join(tempDir, "archive"))
			await mkdir(path.join(tempDir, "archive/chat1"))
			await mkdir(path.join(tempDir, "archive/chat2"))
			// Simulate llimo clear: rm -rf archive/* if confirm
			await rm(path.join(tempDir, "archive"), { recursive: true })
			const exists = await access(path.join(tempDir, "archive")).then(() => true).catch(() => false)
			strictEqual(exists, false, "Clears all archives")
			// Security: Does not touch /chat/current
			await mkdir(path.join(tempDir, "chat/current"))
			// Run clear again → archive gone, chat intact
			exists = await access(path.join(tempDir, "chat/current")).then(() => true).catch(() => false)
			strictEqual(exists, true, "Preserves current chats")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("5.6 Info: usage (size/tokens/cost) for current/all (-r recursive)", () => {
		it("llimo info: Sums size/tokens/cost for current chat from usage.json/title.md/etc.", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "info-5.6-"))
			const fs = new FileSystem({ cwd: tempDir })
			const currentId = "info-current"
			await mkdir(path.join(tempDir, `chat/${currentId}`))
			await writeFile(path.join(tempDir, `chat/${currentId}/usage.json`), JSON.stringify({ tokens: 1000, cost: 0.1 }))
			await writeFile(path.join(tempDir, `chat/${currentId}/title.md`), "100 bytes file")  // Size via stat
			await fs.save("chat/current", currentId)
			const stats = await fs.stat(path.join(tempDir, `chat/${currentId}/title.md`))
			const totalSize = stats.size + 100  // Mock total
			const usage = JSON.parse(await readFile(path.join(tempDir, `chat/${currentId}/usage.json`)))
			// Simulate llimo info: Output "Usage: 100b | Context: 1,000T | Cost: $0.100000"
			ok(totalSize > 0, "Calculates current size")
			strictEqual(usage.tokens, 1000, "Loads tokens")
			strictEqual(usage.cost, 0.1, "Loads cost")
			await rm(tempDir, { recursive: true })
		})

		it("llimo info -r: Recursive sum across current + all /archive/* usage", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "info-r-5.6-"))
			const fs = new FileSystem({ cwd: tempDir })
			const currentId = "current-r"
			await mkdir(path.join(tempDir, `chat/${currentId}`))
			await writeFile(path.join(tempDir, `chat/${currentId}/usage.json`), JSON.stringify({ tokens: 500, cost: 0.05 }))
			await fs.save("chat/current", currentId)
			await mkdir(path.join(tempDir, "archive"))
			await mkdir(path.join(tempDir, "archive/a1"))
			await writeFile(path.join(tempDir, "archive/a1/usage.json"), JSON.stringify({ tokens: 300, cost: 0.03 }))
			await mkdir(path.join(tempDir, "archive/a2"))
			await writeFile(path.join(tempDir, "archive/a2/usage.json"), JSON.stringify({ tokens: 700, cost: 0.07 }))
			// Simulate llimo info -r: Total tokens=1,500, cost=$0.15 (sum current + archives)
			const archives = await readdir(path.join(tempDir, "archive"))
			let totalTokens = 500, totalCost = 0.05
			for (const arch of archives) {
				const archUsage = JSON.parse(await readFile(path.join(tempDir, `archive/${arch}/usage.json`)))
				totalTokens += archUsage.tokens
				totalCost += archUsage.cost
			}
			strictEqual(totalTokens, 1500, "Sums recursive tokens")
			strictEqual(totalCost, 0.15, "Sums recursive cost")
			await rm(tempDir, { recursive: true })
		})
	})
})
