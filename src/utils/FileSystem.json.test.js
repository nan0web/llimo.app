import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { FileSystem } from "./FileSystem.js"

describe("FileSystem – JSON loader & saver", () => {
	let tempDir
	let fs

	beforeEach(async () => {
		tempDir = await mkdtemp(resolve(tmpdir(), "fs-json-test-"))
		fs = new FileSystem({ cwd: tempDir })
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it("saves and loads a JSON file correctly", async () => {
		const data = { hello: "world", count: 42, nested: { a: 1 } }
		const filename = "sample.json"

		await fs.save(filename, data)

		const loaded = await fs.load(filename)
		assert.deepStrictEqual(loaded, data)
	})

	it("appends to a JSONL file without affecting JSON handling", async () => {
		const rows = [{ id: 1 }, { id: 2 }]
		const filename = "log.jsonl"

		await fs.save(filename, rows)          // writes as JSONL
		await fs.append(filename, { id: 3 })   // appends a new line

		const loaded = await fs.load(filename)
		assert.deepStrictEqual(loaded, [{ id: 1 }, { id: 2 }, { id: 3 }])
	})
})
