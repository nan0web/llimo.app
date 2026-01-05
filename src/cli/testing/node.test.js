import { before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))

import { FileSystem } from "../../utils/index.js"
import { Suite } from "./node.js"

describe("Suite", () => {
	const fs = new FileSystem({ cwd: __dirname })
	let nodeTxt
	before(async () => {
		nodeTxt = await fs.load("node.txt")
	})
	it.todo("should parse TAP version 13", async () => {
		const suite = new Suite({ rows: nodeTxt.split("\n"), fs })
		const parsed = suite.parse()
		assert.deepStrictEqual(Object.fromEntries(parsed.counts.entries()), {
			cancelled: 1 + 0,
			duration: 661.434291,
			fail: 1 + 0,
			pass: 1 + 18,
			skip: 1 + 0,
			suites: 0 + 3,
			tests: 5 + 18,
			todo: 1 + 0,
			types: 97,
		})
		assert.deepStrictEqual(parsed.tests[0].file, "node.test.js")
		assert.deepStrictEqual(parsed.tests[0].position, [15, 2])
		assert.deepStrictEqual(parsed.tests[2].doc?.code, "ERR_ASSERTION")
		assert.deepStrictEqual(parsed.tests[4].doc?.code, "ERR_TEST_FAILURE")
		assert.deepStrictEqual(parsed.tests[4].doc?.failureType, "testTimeoutFailure")
		assert.deepStrictEqual(parsed.tests[6].type, "pass")
		assert.deepStrictEqual(parsed.tests[6].doc?.type, "test")
		assert.deepStrictEqual(parsed.tests[119].file, "src/strategies/fastest.js")
		assert.deepStrictEqual(parsed.tests[119].position, [75, 11])
	})
	it("should produce OK", () => {
		assert.ok(true)
	})
	it.todo("should produce FAIL", () => {
		assert.fail()
	})
	it.todo("should produce FAIL", () => {
		assert.fail()
	})
	it.todo("should be cancelled", async () => {
		await new Promise(resolve => setTimeout(() => resolve(), 999))
	})
})
