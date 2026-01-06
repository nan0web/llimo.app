import { describe, it, afterEach, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import { unpackAnswer } from "./unpack.js"
import { FileSystem } from "../utils/FileSystem.js"
import { FileEntry } from "../FileProtocol.js"

describe("unpackAnswer", () => {
	let mockFs

	beforeEach(() => {
		mock.restoreAll()
		mockFs = new FileSystem()
		global.__llimoFs = mockFs
		mock.method(console, "info", () => {})
	})

	afterEach(() => {
		delete global.__llimoFs
	})

	it("processes file entries in dry mode", async () => {
		const parsed = {
			correct: [
				new FileEntry({ filename: "example.js", content: "console.info('test')" }),
				new FileEntry({ filename: "example.txt", content: "hello world" })
			],
			failed: []
		}
		const lines = []
		for await (const line of unpackAnswer(parsed, true)) {
			lines.push(line)
		}
		assert.ok(lines.length > 0, "Should generate output lines")
		assert.ok(lines.some(l => String(l).includes("example.js")), "Should process JS file")
		assert.ok(lines.some(l => String(l).includes("dry mode")), "Should indicate dry run")
	})

	it("saves files and generates save messages", async () => {
		const saveSpy = mock.fn(async (path, content) => {
			assert.match(path, /\.js$/)
			assert.ok(content.length > 0)
		})
		mock.method(mockFs, "save", saveSpy)

		const parsed = {
			correct: [new FileEntry({ filename: "test.js", content: "// code" })],
			failed: []
		}

		const lines = []
		for await (const line of unpackAnswer(parsed)) {
			lines.push(line)
		}
		assert.strictEqual(saveSpy.mock.callCount(), 1, "Should save one file")
		assert.ok(lines.some(l => String(l).includes("test.js")), "Should log save")
		assert.ok(lines.some(l => String(l).includes("bytes")), "Should log size")
	})

	it("handles empty file content without saving", async () => {
		const parsed = { correct: [new FileEntry({ filename: "empty.md", content: "" })], failed: [] }
		const lines = []
		const saveSpy = mock.fn()
		mock.method(mockFs, "save", saveSpy)

		for await (const line of unpackAnswer(parsed)) {
			lines.push(line)
		}
		assert.strictEqual(saveSpy.mock.callCount(), 0, "Should not save empty file")
		assert.ok(lines.some(l => String(l).includes("empty content")), "Should log empty warning")
	})

	it("processes command entries (@ prefixed)", async () => {
		const parsed = {
			correct: [new FileEntry({ filename: "@summary", content: "Test summary", label: "Summary" })],
			failed: []
		}
		const lines = []
		for await (const line of unpackAnswer(parsed)) {
			lines.push(line)
		}
		assert.ok(lines.length > 0, "Should process command")
		assert.ok(lines.some(l => String(l).includes("@summary")), "Should handle @ command")
	})

	it("groups and reports parse errors from failed entries", async () => {
		const parsed = {
			correct: [],
			failed: [
				{
					error: new Error("Syntax error at line 5"),
					content: "invalid syntax",
					line: 5
				},
				{
					error: new Error("Missing field at line 10"),
					content: "{}",
					line: 10
				}
			]
		}
		const lines = []
		for await (const line of unpackAnswer(parsed)) {
			lines.push(line)
		}
		assert.strictEqual(lines.filter(l => String(l).includes("Error")).length >= 1, true, "Should report errors")
		assert.ok(lines.some(l => String(l).includes("Syntax error")), "Should include first error")
		assert.ok(lines.some(l => String(l).includes("Missing field")), "Should include second error")
	})
})
