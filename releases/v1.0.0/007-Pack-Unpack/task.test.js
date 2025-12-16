import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("007-Pack-Unpack – pack.js, unpack.js", () => {
	describe("7.1 packMarkdown bundles files", async () => {
		it("packs checklist refs", async () => {
			const packPath = resolve(rootDir, "src/llm/pack.js")
			const { packMarkdown } = await import(`file://${packPath}`)
			const { text } = await packMarkdown({ input: "- [](package.json)" })
			assert.ok(text.includes("####"), "Generates MD blocks")
		})
	})
})
