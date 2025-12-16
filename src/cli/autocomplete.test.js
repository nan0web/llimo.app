import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"

import { modelRows, filterModels, formatContext, highlightCell, parseFieldFilter, renderTable } from "./autocomplete.js"
import ModelInfo from "../llm/ModelInfo.js"
import Pricing from "../llm/Pricing.js"
import Architecture from "../llm/Architecture.js"
import { RESET, YELLOW } from "./ANSI.js"

// Test model map - each has only one info, but to test max logic, add multiple for same id
const testModelMap = new Map([
	[
		"qwen-3-32b",
		[
			// First variant with higher context
			new ModelInfo({
				id: "qwen-3-32b",
				context_length: 8192,
				pricing: new Pricing({ prompt: 0.003, completion: 0.004 }),
				provider: "cerebras",
				architecture: new Architecture({ modality: "text", input_modalities: ["text"] }),
				supports_tools: true,
				supports_structured_output: false
			}),
			// Second variant with lower context to test Math.max
			new ModelInfo({
				id: "qwen-3-32b",
				context_length: 4096,
				pricing: new Pricing({ prompt: 0.002, completion: 0.003 }),
				provider: "cerebras-alt",
				architecture: new Architecture({ modality: "text" }),
				supports_tools: false,
				supports_structured_output: true
			})
		]
	],
	[
		"qwen-3-32b-hf",
		[
			new ModelInfo({
				id: "qwen-3-32b-hf",
				context_length: 4096,
				pricing: new Pricing({ prompt: -1, completion: -1 }),
				provider: "huggingface/novita",
				architecture: new Architecture({ modality: "text" }),
				supports_tools: false,
				supports_structured_output: true
			})
		]
	]
])

describe("autocomplete – core functions", () => {
	describe("modelRows", () => {
		it("flattens map correctly", () => {
			const rows = modelRows(testModelMap)
			assert.strictEqual(rows.length, 3)
			assert.strictEqual(rows[0].id, "qwen-3-32b")
			assert.strictEqual(rows[0].context, 8192) // Max of 8192 and 4096
			assert.strictEqual(rows[0].provider, "cerebras") // First variant's provider
			assert.strictEqual(rows[1].id, "qwen-3-32b")
			assert.strictEqual(rows[1].context, 4096)
			assert.strictEqual(rows[1].provider, "cerebras-alt")
			assert.strictEqual(rows[2].id, "qwen-3-32b-hf")
			assert.strictEqual(rows[2].context, 4096)
			assert.strictEqual(rows[2].provider, "huggingface/novita")
		})
	})

	describe("formatContext", () => {
		it("formats small numbers as T", () => {
			assert.strictEqual(formatContext(123), "123T")
		})

		it("formats thousands as K", () => {
			assert.strictEqual(formatContext(131072), "131K")
		})

		it("formats millions as M", () => {
			assert.strictEqual(formatContext(1000000), "1M")
		})
	})

	describe("highlightCell", () => {
		it("no highlight for empty search", () => {
			assert.strictEqual(highlightCell("test", ""), "test")
		})

		it("highlights match in ID", () => {
			const hl = highlightCell("qwen-3-model", "qwen")
			assert.ok(hl.includes(YELLOW + "qwen" + RESET))
		})

		it("highlights match in provider", () => {
			const hl = highlightCell("huggingface-novita", "novita")
			assert.ok(hl.includes(YELLOW + "novita" + RESET))
		})

		it("no highlight for command search", () => {
			assert.strictEqual(highlightCell("test", "/help"), "test")
		})
	})

	describe("parseFieldFilter", () => {
		it("parses field=value", () => {
			const parsed = parseFieldFilter("provider=novita")
			assert.deepStrictEqual(parsed, { field: "provider", op: "=", value: "novita" })
		})

		it("parses field op value", () => {
			const parsed = parseFieldFilter("context>8K")
			assert.deepStrictEqual(parsed, { field: "context", op: ">", value: "8K" })
		})

		it("parses simple includes (no =)", () => {
			const parsed = parseFieldFilter("qwen")
			assert.deepStrictEqual(parsed, { field: "", op: "", value: "qwen" })
		})
	})

	describe("filterModels", () => {
		const allModels = modelRows(testModelMap)

		it("filters by ID substring", () => {
			const result = filterModels(allModels, "qwen-3-32b")
			assert.strictEqual(result.length, 2)
			assert.ok(result[0].id.includes("qwen-3-32b"))
		})

		it("filters by provider substring", () => {
			const result = filterModels(allModels, "novita")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].provider, "huggingface/novita")
		})

		it("filters by @provider=value", () => {
			const result = filterModels(allModels, "@provider=novita")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].provider, "huggingface/novita")
		})

		it("filters by @id=value", () => {
			const result = filterModels(allModels, "@id=qwen-3-32b")
			assert.strictEqual(result.length, 2)
			assert.ok(result.every(r => r.id === "qwen-3-32b"))
		})

		it("filters numerically by @context>4096", () => {
			const result = filterModels(allModels, "@context>4096")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].context, 8192)
		})

		it("supports K/M suffixes in numeric filters", () => {
			const result = filterModels(allModels, "@context>4K") // 4000
			assert.strictEqual(result.length, 3)

			const result2 = filterModels(allModels, "@context>8K") // 8000
			assert.strictEqual(result2.length, 1)
			assert.strictEqual(result2[0].context, 8192)
		})

		it("returns all for empty search", () => {
			const result = filterModels(allModels, "")
			assert.deepStrictEqual(result, allModels)
		})

		it("ignores filtering in command mode", () => {
			const result = filterModels(allModels, "/help")
			assert.deepStrictEqual(result, allModels)
		})

		it("handles invalid field as no match", () => {
			const result = filterModels(allModels, "@invalid=foo")
			assert.strictEqual(result.length, 0)
		})
	})
})

describe("renderTable", () => {
	const mockUi = {
		console: {
			info: () => {},
			table: mock.fn()
		}
	}
	const mockRows = [
		{ id: "long-model-id-123456789", context: 8192, provider: "test/novita", modality: "text", inputPrice: -1, outputPrice: 0.004, tools: true, json: false }
	]

	it("renders table with highlighting in ID and provider", () => {
		renderTable(mockRows, "novita", 0, 10, mockUi)
		assert.strictEqual(mockUi.console.table.mock.callCount(), 1)
	})

	it("handles negative pricing as '-'", () => {
		renderTable(mockRows, "", 0, 10, mockUi)
	})
})

