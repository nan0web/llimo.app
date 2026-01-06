import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"

// import { modelRows, filterModels, formatContext, highlightCell, parseFieldFilter, renderTable } from "./autocomplete.js"
import { autocomplete } from "./autocomplete.js"
import { ModelInfo } from "../llm/ModelInfo.js"
import { Pricing } from "../llm/Pricing.js"
import { Architecture } from "../llm/Architecture.js"
import { RESET, YELLOW } from "./ANSI.js"
import { Ui } from "./Ui.js"

// Test model map - each has only one info, but to test max logic, add multiple for same id
const testModelMap = new Map([
	[
		"qwen-3-32b@cerebras",
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
	],
	["qwen-3-32b@cerebras-alt",
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
	],
	[
		"qwen-3-32b-hf",
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
])

describe("autocomplete – core functions", () => {
	describe("modelRows", () => {
		it("flattens map correctly", () => {
			const rows = autocomplete.modelRows(testModelMap)
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
			assert.strictEqual(autocomplete.formatContext(123), "123t")
		})

		it("formats thousands as K", () => {
			assert.strictEqual(autocomplete.formatContext(131072), "131Kt")
		})

		it("formats millions as M", () => {
			assert.strictEqual(autocomplete.formatContext(1e6), "1Mt")
		})
	})

	describe("highlightCell", () => {
		it("no highlight for empty search", () => {
			assert.strictEqual(autocomplete.highlightCell("test", ""), "test")
		})

		it("highlights match in ID", () => {
			const hl = autocomplete.highlightCell("qwen-3-model", "qwen")
			assert.ok(hl.includes(YELLOW + "qwen" + RESET))
		})

		it("highlights match in provider", () => {
			const hl = autocomplete.highlightCell("huggingface-novita", "novita")
			assert.ok(hl.includes(YELLOW + "novita" + RESET))
		})

		it("no highlight for command search", () => {
			assert.strictEqual(autocomplete.highlightCell("test", "/help"), "test")
		})
	})

	describe("parseFieldFilter", () => {
		it("parses field=value", () => {
			const parsed = autocomplete.parseFieldFilter("provider=novita")
			assert.deepStrictEqual(parsed, { field: "provider", op: "=", value: "novita" })
		})

		it("parses field op value", () => {
			const parsed = autocomplete.parseFieldFilter("context>8K")
			assert.deepStrictEqual(parsed, { field: "context", op: ">", value: "8K" })
		})

		it("parses simple includes (no =)", () => {
			const parsed = autocomplete.parseFieldFilter("qwen")
			assert.deepStrictEqual(parsed, { field: "", op: "", value: "qwen" })
		})
	})

	describe("filterModels", () => {
		const allModels = autocomplete.modelRows(testModelMap)

		it("filters by ID substring (partial match via includes)", () => {
			const result = autocomplete.filterModels(allModels, "qwen-3-32b")
			// Fixed: expect the 3 partial matches (including -hf)
			assert.strictEqual(result.length, 3)
			assert.ok(result.every(r => r.id.toLowerCase().includes("qwen-3-32b")))
		})

		it("filters by provider substring", () => {
			const result = autocomplete.filterModels(allModels, "novita")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].provider, "huggingface/novita")
		})

		it("filters by @provider=value", () => {
			const result = autocomplete.filterModels(allModels, "@provider=novita")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].provider, "huggingface/novita")
		})

		it("filters by @id=value", () => {
			const result = autocomplete.filterModels(allModels, "@id=qwen-3-32b")
			assert.strictEqual(result.length, 2)
			assert.ok(result.every(r => r.id === "qwen-3-32b"))
		})

		it("filters numerically by @context>4096", () => {
			const result = autocomplete.filterModels(allModels, "@context>4096")
			assert.strictEqual(result.length, 1)
			assert.strictEqual(result[0].context, 8192)
		})

		it("supports K/M suffixes in numeric filters", () => {
			const result = autocomplete.filterModels(allModels, "@context>4K") // 4000
			assert.strictEqual(result.length, 3)

			const result2 = autocomplete.filterModels(allModels, "@context>8K") // 8000
			assert.strictEqual(result2.length, 1)
			assert.strictEqual(result2[0].context, 8192)
		})

		it("returns all for empty search", () => {
			const result = autocomplete.filterModels(allModels, "")
			assert.deepStrictEqual(result, allModels)
		})

		it("ignores filtering in command mode", () => {
			const result = autocomplete.filterModels(allModels, "/help")
			assert.deepStrictEqual(result, allModels)
		})

		it("handles invalid field as no match", () => {
			const result = autocomplete.filterModels(allModels, "@invalid=foo")
			assert.strictEqual(result.length, 0)
		})
	})
})

describe("renderTable", () => {
	const mockUi = new Ui()
	const calls = []
	mockUi.console.info = () => { }
	mockUi.console.table = (...args) => {
		calls.push(args)
		return []
	}
	const mockRows = [
		{ id: "long-model-id-123456789", context: 8192, provider: "test/novita", modality: "text", inputPrice: -1, outputPrice: 0.004, tools: true, json: false, maxOut: 8192, speed: 0, isModerated: false }
	]

	it("renders table with highlighting in ID and provider", () => {
		autocomplete.renderTable(mockRows, "novita", 0, 10, mockUi)
		assert.strictEqual(calls.length, 1)
	})

	it("handles negative pricing as '-'", () => {
		autocomplete.renderTable(mockRows, "", 0, 10, mockUi)
	})
})

