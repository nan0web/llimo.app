import { describe, it } from "node:test"
import assert from "node:assert"
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import FileSystem from "../../utils/FileSystem.js"
import Markdown from "../../utils/Markdown.js"
import ValidateCommand from "./ValidateCommand.js"
import Alert from "../../cli/components/Alert.js"
const __dirname = dirname(fileURLToPath(import.meta.url))

describe("ValidateCommand", () => {
	const fs = new FileSystem({ cwd: __dirname })
	it("should validate answer", async () => {
		const content = await fs.load("ValidateCommand.test.md")
		const parsed = await Markdown.parse(content)
		const file = parsed.correct.find(entry => "@validate" === entry.filename)
		const cmd = new ValidateCommand({ cwd: __dirname, file, parsed })
		const output = []
		for await (const str of cmd.run()) {
			output.push(str instanceof Alert ? str.text : String(str))
		}
		assert.deepStrictEqual(output, [
			'! LLiMo following format errors ------------------------------',
			'  Unexpected response "2 file(s), 0 command(s)"',
			'  but provided (parsed response): 6 file(s), 0 command(s)',
			'  ------------------------------------------------------------',
			'  ℹ label format for @validate is "#### [N file(s), M command(s)](@validate)"',
			'    where:',
			'      N - amount of file(s) minus command(s)',
			'      M - amount of commands(s) minus validate command (-1)',
			'    if amount is zero part with its number might be skipped',
			'  ------------------------------------------------------------',
			'+ Expected validation of files 100% valid',
		])
	})
})
