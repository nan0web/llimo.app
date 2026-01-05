import { describe, it } from "node:test"
import assert from "node:assert"
import { MarkdownProtocol } from "../../utils/Markdown.js"
import BashCommand from "./BashCommand.js"

describe("BashCommand", () => {
	it("should emit the command block with proper markers", async () => {
		const markdown = `
#### [Setup](@bash)
\`\`\`bash
echo hello
\`\`\`
`
		const parsed = await MarkdownProtocol.parse(markdown)
		const file = parsed.correct?.find((e) => e.filename === "@bash")
		assert.ok(file, "Expected @bash entry")

		const cmd = new BashCommand({ file, parsed })
		const out = []
		for await (const line of cmd.run()) out.push(line)

		// The first line contains the YELLOW marker.
		assert.ok(out[0].includes("Execute command"))
		// The actual command must appear in the generated lines.
		assert.ok(out.some((l) => l.includes("echo hello")), "Command not emitted")
	})
})
