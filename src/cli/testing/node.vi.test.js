import { before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))

import { FileSystem } from "../../utils/index.js"
import { Suite } from "./node.js"

describe("Suite", () => {
	const fs = new FileSystem({ cwd: __dirname })
	let tapTxt
	before(async () => {
		tapTxt = await fs.load("vitest.failure.txt")
	})
	it("should parse TAP version 13", async () => {
		const suite = new Suite({ rows: tapTxt.split("\n"), fs })
		const parsed = suite.parse()
		assert.deepStrictEqual(Object.fromEntries(parsed.counts.entries()), {
			cancelled: 0,
			duration: 0,
			fail: 2,
			pass: 0,
			skip: 0,
			suites: 0,
			tests: 2,
			todo: 0,
			types: 0,
		})
		assert.ok(parsed.tests[0].file?.endsWith("App.test.jsx"))
		assert.deepStrictEqual(parsed.tests[0].position, [0, 0])
		assert.deepStrictEqual(parsed.tests[0].doc?.error.name, "ReferenceError")
		assert.deepStrictEqual(parsed.tests[0].doc?.error.message, "expect is not defined")
		assert.deepStrictEqual(parsed.tests[0].indent, 4)
		assert.deepStrictEqual(parsed.tests[0].type, "fail")
	})
})
