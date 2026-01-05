import { before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { FileSystem } from "../../utils/index.js"
import { Tap } from "./node.js"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))

describe("node.failure.txt handling", () => {
	const fs = new FileSystem({ cwd: __dirname })
	/** @type {string} */
	let txt

	before(async () => {
		txt = await fs.load("node.failure.txt")
	})

	it.todo("should parse a failing TAP run from node.failure.txt", () => {
		const tap = new Tap({ rows: txt.split("\n"), fs })
		const parsedTap = tap.parse()
		// ensure we have at least one test entry
		assert.ok(Array.isArray(parsedTap.tests) && parsedTap.tests.length > 0, "no tests parsed")
		const first = parsedTap.tests[0]
		// the first subtest is a failed suite
		assert.strictEqual(first.type, "fail")
		// location should resolve to the relative file name
		assert.strictEqual(first.file, "node.test.js")
		// error code from the YAML block must be captured
		assert.strictEqual(first.doc?.code, "ERR_TEST_FAILURE")
	})
})
