import { describe, it } from "node:test"
import assert from "node:assert"
import { MarkdownProtocol } from "../../utils/Markdown.js"
import SummaryCommand from "./SummaryCommand.js"

describe("SummaryCommand", () => {
	it("should display summary message", async () => {
		const markdown = `
#### [Changes](@summary)
\`\`\`txt
Key updates:
- Fixed file listing
- Added new commands
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@summary")
		assert.ok(file, "Expected @summary entry")

		const cmd = new SummaryCommand({ file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		assert.deepStrictEqual(out, [
			" ℹ Summary:",
			"   Key updates:",
			"   - Fixed file listing",
			"   - Added new commands",
		])
	})

	it("should handle empty summary", async () => {
		const markdown = `
#### [Empty](@summary)
\`\`\`txt

\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@summary")
		assert.ok(file, "Expected @summary entry")

		const cmd = new SummaryCommand({ file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		assert.deepStrictEqual(out, [
			" ℹ Empty summary"
		])
	})
})
