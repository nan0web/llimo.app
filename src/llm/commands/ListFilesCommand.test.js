import { describe, it } from "node:test"
import assert from "node:assert"
import Markdown from "../../utils/Markdown.js"
import ListFilesCommand from "./ListFilesCommand.js"

describe("ListFilesCommand (stub)", () => {
	it("produces no output when not implemented", async () => {
		const markdown = `
#### [List](@ls)
\`\`\`txt
src/**
\`\`\`
`
		const parsed = await Markdown.parse(markdown)
		const file = parsed.correct.find((e) => e.filename === "@ls")
		assert.ok(file, "Expected @ls entry")
		const cmd = new ListFilesCommand({ file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// Current stub yields nothing.
		assert.deepStrictEqual(out, [])
	})
})
