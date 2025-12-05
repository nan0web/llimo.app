import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Readable, Writable } from "node:stream"

import ReadLine from "./ReadLine.js"

describe("ReadLine", () => {
	describe("createInterface", () => {
		it.skip("creates and returns a readline Interface", () => {
			const rl = new ReadLine()
			const options = { input: process.stdin, output: process.stdout }
			const result = rl.createInterface(options)
			assert.ok(result instanceof readline.Interface)
		})
	})

	describe("interactive", () => {
		it("handles stopWord without errors", async () => {
			// Mock streams to avoid interacting with real stdin/stdout
			const mockStdin = new Readable({
				read() {}, // We'll push data manually
			})
			const mockStdout = new Writable({
				write(chunk, encoding, callback) {
					callback() // ignore output
				},
			})

			const rl = new ReadLine({ input: mockStdin, output: mockStdout })
			const promise = rl.interactive({ stopWord: "end" })

			// Simulate user typing
			mockStdin.push("Hello!\n")
			mockStdin.push("end\n")
			mockStdin.push(null) // end of stream

			const result = await promise

			assert.strictEqual(result, "Hello!\n")
		})

		it.skip("handles stopKeys without errors", async () => {
			const rl = new ReadLine()
			const result = await rl.interactive({ stopKeys: "ctrl" })
			assert.strictEqual(typeof result, "string")
		})

		it.skip("handles question parameter", async () => {
			const mockOutput = { write: () => {} }
			const rl = new ReadLine({ output: mockOutput })
			const result = await rl.interactive({ question: "Query?" })
			assert.strictEqual(typeof result, "string")
		})
	})
})
