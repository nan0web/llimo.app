import { describe, it } from "node:test"
import assert from "node:assert/strict"
import Markdown from "../../../src/utils/Markdown.js"

describe("003-File-Protocol – src/FileProtocol.js, Markdown.js", () => {
	describe("3.1 Parse markdown to ParsedFile", () => {
		it("parses valid MD with @validate", async () => {
			const parsed = await Markdown.parse(`
#### [test](file.js)
\`\`\`js
console.log(1)
\`\`\`
#### [1 file(s)](@validate)
\`\`\`md
- [test](file.js)
\`\`\`
`)
			assert.strictEqual(parsed.isValid, true)
			assert.strictEqual(parsed.correct.length, 2)
		})
	})
})
