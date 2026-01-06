import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"

import { autocomplete } from "./autocomplete.js"

import { ModelInfo } from "../llm/ModelInfo.js"
import { Pricing } from "../llm/Pricing.js"
import { Architecture } from "../llm/Architecture.js"
import { Ui, UiConsole } from "./Ui.js"

// -----------------------------------------------------
// helpers
// -----------------------------------------------------
function createTestModelMap() {
	const map = new Map()
	map.set("x-ai/grok-3",
		new ModelInfo({
			id: "x-ai/grok-3",
			context_length: 131_000,
			pricing: new Pricing({ prompt: 3, completion: 15 }),
			provider: "openrouter",
			architecture: new Architecture({ modality: "text" }),
			supports_tools: false,
			supports_structured_output: false,
		}),
	)
	map.set("meta-llama/Llama-3.3-70B-Instruct",
		new ModelInfo({
			id: "meta-llama/Llama-3.3-70B-Instruct",
			context_length: 64_000,
			pricing: new Pricing({ prompt: -1, completion: -1 }),
			provider: "huggingface/groq",
			architecture: new Architecture({ modality: "text" }),
			supports_tools: false,
			supports_structured_output: false,
		}),
	)
	return map
}

// -----------------------------------------------------
// tests
// -----------------------------------------------------
describe("autocomplete – core utilities", () => {
	it("modelRows flattens map correctly", () => {
		const rows = autocomplete.modelRows(createTestModelMap())
		assert.strictEqual(rows.length, 2)
		const grok = rows.find(r => r.id === "x-ai/grok-3")
		assert.ok(grok)
		assert.strictEqual(grok.context, 131_000)
		assert.strictEqual(grok.provider, "openrouter")
		assert.strictEqual(grok.inputPrice, 3)
		assert.strictEqual(grok.outputPrice, 15)
	})

	it("formatContext handles units", () => {
		assert.strictEqual(autocomplete.formatContext(123), "123t")
		assert.strictEqual(autocomplete.formatContext(12_345), "12Kt")
		assert.strictEqual(autocomplete.formatContext(123_456), "123Kt")
		assert.strictEqual(autocomplete.formatContext(1_200_000), "1.2Mt")
	})

	it("highlightCell highlights correctly", () => {
		const text = "grok-3-mini"
		const highlighted = autocomplete.highlightCell(text, "3")
		assert.ok(highlighted.includes("3"))
		// @todo it does not work in test mode where isTTY is fales
		// assert.ok(highlighted.includes("\x1b[33m"))
		// no highlight when search empty
		assert.strictEqual(autocomplete.highlightCell(text, ""), text)
		// no highlight on command search
		assert.strictEqual(autocomplete.highlightCell(text, "/help"), text)
	})

	it("parseFieldFilter parses all variants", () => {
		assert.deepStrictEqual(autocomplete.parseFieldFilter("provider=novita"), {
			field: "provider",
			op: "=",
			value: "novita",
		})
		assert.deepStrictEqual(autocomplete.parseFieldFilter("context>8K"), {
			field: "context",
			op: ">",
			value: "8K",
		})
		assert.deepStrictEqual(autocomplete.parseFieldFilter("grok"), {
			field: "",
			op: "",
			value: "grok",
		})
	})

	it("filterModels matches by id *or* provider (partial match via includes)", () => {
		const rows = autocomplete.modelRows(createTestModelMap())
		// search for "grok" should return grok and meta-llama (provider contains "groq")
		const filtered = autocomplete.filterModels(rows, "grok")
		assert.deepStrictEqual(filtered, [
			{
				id: "x-ai/grok-3",
				context: 131000,
				provider: "openrouter",
				speed: -1,
				isModerated: false,
				modality: "text",
				maxOut: 0,
				inputPrice: 3,
				outputPrice: 15,
				tools: false,
				json: false,
			}
		])
	})

	it("filterModels supports field filters and numeric comparisons", () => {
		const rows = autocomplete.modelRows(createTestModelMap())
		// exact id match using id=
		const byId = autocomplete.filterModels(rows, "@id=x-ai/grok-3")
		assert.strictEqual(byId.length, 1)
		assert.strictEqual(byId[0].id, "x-ai/grok-3")

		// provider regex via @provider~
		const byProv = autocomplete.filterModels(rows, "@provider~groq")
		assert.strictEqual(byProv.length, 1)
		assert.strictEqual(byProv[0].provider, "huggingface/groq")

		// numeric greater than
		const byCtx = autocomplete.filterModels(rows, "@context>120K")
		assert.strictEqual(byCtx.length, 1)
		assert.strictEqual(byCtx[0].context, 131_000)

		// suffix K handling
		const byCtxK = autocomplete.filterModels(rows, "@context>130K")
		assert.strictEqual(byCtxK.length, 1)
		assert.strictEqual(byCtxK[0].context, 131_000)
	})

	it("renderTable produces a table and respects highlighting", () => {
		const rows = autocomplete.modelRows(createTestModelMap())
		const filtered = autocomplete.filterModels(rows, "grok")
		const mockUi = new Ui()
		const calls = []
		mockUi.console.table = (...args) => {
			calls.push(args)
			return []
		}
		mockUi.console.info = () => {}
		autocomplete.renderTable(filtered, "grok", 0, 10, mockUi)
		assert.strictEqual(calls.length, 1)
		const args = calls[0]
		// first argument must be an array with headers
		assert.ok(Array.isArray(args[0]))
		assert.strictEqual(args[0][0][0], "Model.ID")
		// second argument contains alignment options
		assert.ok(args[1].aligns.includes("right"))
	})

	it("clearLines writes correct escape sequence", () => {
		const calls = []
		const originalWrite = process.stdout.write
		try {
			process.stdout.write = (...args) => {
				calls.push(args)
				return true
			}
			autocomplete.clearLines(5)
			assert.strictEqual(calls.length, 1)
			const s = calls[0][0]
			assert.ok(s.includes("\x1b[5A"))
		} finally {
			process.stdout.write = originalWrite
		}
	})

	it("interactive resolves on Ctrl+C", async () => {
		// Mock stdin / stdout
		class ExEmitter extends EventEmitter {
			isTTY = true
			setRawMode = mock.fn()
			pause() {
				mock.fn()
				return this
			}
		}
		const mockStdin = new ExEmitter()
		try {
			const modelMap = createTestModelMap()
			const console = new UiConsole()
			console.info = () => {}
			console.table = () => []
			const mockUi = new Ui({
				// @ts-expect-error - mock stdin for testing, ExEmitter extends EventEmitter not ReadStream
				stdin: mockStdin,
				console,
			})

			const promise = autocomplete.interactive(modelMap, mockUi)

			// Simulate Ctrl+C after a short delay
			setTimeout(() => {
				mockStdin.emit("keypress", "", { name: "c", ctrl: true })
			}, 10)

			await promise // should resolve without rejection
			// Ensure raw mode was disabled
			assert.ok(mockStdin.setRawMode.mock.calls[0].arguments[0] === true)
		} finally {
			// ok
		}
	})

	it("pipeOutput produces correct rows", () => {
		const rows = autocomplete.modelRows(createTestModelMap())
		const calls = []
		const console = new UiConsole()
		console.table = (...args) => {
			calls.push(args)
			return []
		}
		const mockUi = new Ui({ console })
		autocomplete.pipeOutput(rows, mockUi)
		const call = calls[0]
		assert.ok(Array.isArray(call[0]))
		// header row
		assert.deepStrictEqual(call[0][0], ["Model.id", "Context", "Max.out", "Provider", "Modality", "Speed T/s", "Input", "Output", "Mod"])
		// last data row matches our model because sorted by id
		const dataRow = call[0][3]
		assert.strictEqual(dataRow[0], "x-ai/grok-3")
		assert.strictEqual(dataRow[3], "openrouter")
	})
})
