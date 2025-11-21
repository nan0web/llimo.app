import { describe, it } from "node:test"
import assert from "node:assert"
import { Readable } from "node:stream"
import readline from "node:readline"

import JSONL from "./JSONL.js"
import FileSystem from "./FileSystem.js"
import { FileEntry } from "../FileProtocol.js"

const fs = new FileSystem()

describe("JSONL.parseStream", () => {
	const rows = [
		'{"filename":"1.txt","content":"true"}\n',
		'{"filename":"test.md","content":"```js\\nconst arr = String(\\"1\\n2\\n3\\").split(\\"\\n\\")\\n```\\n"}\n'
	]
	const stream = readline.createInterface(Readable.from(rows.join("")))
	it("should parse with new lines", async () => {
		const result = await JSONL.parseStream(stream)
		assert.deepStrictEqual(result.correct, [
			new FileEntry({ filename: "1.txt", content: "true" }),
			new FileEntry({ filename: "test.md", content: '```js\nconst arr = String("1\n2\n3").split("\n")\n```\n' }),
		], result.failed)
		for (const { filename, content } of result.correct) {
			await fs.save(`dist/jsonl-parseStream.test/${filename}`, content)
		}
	})
})
