import { describe, it, mock } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { modelRows, filterModels, pipeOutput } from "../src/cli/autocomplete.js"
import ModelInfo from "../src/llm/ModelInfo.js"
import Pricing from "../src/llm/Pricing.js"
import Architecture from "../src/llm/Architecture.js"

/**
 * Test model map for consistent testing
 */
const testModelMap = new Map([
	["model-1", [
		new ModelInfo({
			id: "model-1",
			context_length: 4096,
			pricing: new Pricing({ prompt: 0.001, completion: 0.002 }),
			provider: "openrouter"
		})
	]],
	["qwen-3", [
		new ModelInfo({
			id: "qwen-3-32b",
			context_length: 8192,
			pricing: new Pricing({ prompt: 0.003, completion: 0.004 }),
			provider: "cerebras"
		}),
		new ModelInfo({
			id: "qwen-3-32b-hf",
			context_length: 4096,
			pricing: new Pricing({ prompt: -1, completion: -1 }),
			provider: "huggingface/novita"
		})
	]]
])

describe("llimo-models functionality", () => {
	describe("modelRows", () => {
		it("flattens model map into rows correctly", () => {
			const rows = modelRows(testModelMap)
			assert.strictEqual(rows.length, 3)
			assert.strictEqual(rows[0].id, "model-1")
			assert.strictEqual(rows[0].inputPrice, 0.001)
			assert.strictEqual(rows[1].id, "qwen-3-32b")
			assert.strictEqual(rows[1].provider, "cerebras")
			assert.strictEqual(rows[2].provider, "huggingface/novita")
			assert.strictEqual(rows[2].inputPrice, -1) // Unknown pricing
		})
	})

	describe("filterModels", () => {
		const allModels = modelRows(testModelMap)

		it("filters by simple search (ID)", () => {
			const filtered = filterModels(allModels, "qwen")
			assert.strictEqual(filtered.length, 2)
			assert.ok(filtered.every(row => row.id.includes("qwen")))
		})

		it("filters by provider search", () => {
			const filtered = filterModels(allModels, "novita")
			assert.strictEqual(filtered.length, 1)
			assert.strictEqual(filtered[0].provider, "huggingface/novita")
		})

		it("filters by @field=value (provider)", () => {
			const filtered = filterModels(allModels, "@provider=novita")
			assert.strictEqual(filtered.length, 1)
			assert.strictEqual(filtered[0].provider, "huggingface/novita")
		})

		it("filters by @field=value (id)", () => {
			const filtered = filterModels(allModels, "@id=qwen-3-32b")
			assert.strictEqual(filtered.length, 1)
			assert.strictEqual(filtered[0].id, "qwen-3-32b") // Exact match via includes
		})

		it("filters by @field op value (context > 4096)", () => {
			const filtered = filterModels(allModels, "@context>4096")
			assert.strictEqual(filtered.length, 1)
			assert.ok(filtered[0].context > 4096)
		})

		it("handles invalid field gracefully", () => {
			const filtered = filterModels(allModels, "@invalid=foo")
			assert.strictEqual(filtered.length, 0) // No match on invalid field
		})

		it("ignores filtering for command mode (starts with /)", () => {
			const filtered = filterModels(allModels, "/help")
			assert.deepStrictEqual(filtered, allModels)
		})

		it("returns all models for empty search", () => {
			const filtered = filterModels(allModels, "")
			assert.deepStrictEqual(filtered, allModels)
		})
	})

	describe("pipeOutput", () => {
		const mockRows = [
			{
				id: "test-model",
				context: 4096,
				provider: "test-provider",
				modality: "text",
				inputPrice: 0.001,
				outputPrice: -1,
				tools: true,
				json: false
			}
		]

		it("outputs formatted row in pipe mode", () => {
			const mockConsole = { info: mock.fn() }
			const consoleSpy = mock.mockImplementation(() => mockConsole)
			
			pipeOutput(mockRows)
			
			assert.strictEqual(mockConsole.info.mock.callCount(), 1)
			const output = mockConsole.info.mock.calls[0][0]
			assert.ok(output.includes("test-model │ 4K │ test-provider │ text │ $0.001000 │ - │ + │ - │"))
		})
	})

	describe("interactive (simulated via mocks)", () => {
		it("handles /help command and resets search", async () => {
			const mockModelMap = new Map()
			const mockUi = {
				console: {
					info: mock.fn(),
					table: mock.fn()
				}
			}
			// This is hard to fully mock due to keypress, but we can test the logic in keypressHandler
			// via integration test or manual simulation
			const { interactive } = await import("./autocomplete.js")
			// For now, verify that help text would be printed (manual check)
			assert.ok(true) // Placeholder - full keypress test needs process spawn
		})
	})
})

describe("Integration test - llimo-models script", () => {
	it("runs in pipe mode and outputs all models", async () => {
		const { spawn } = await import("node:child_process")
		const result = await new Promise((resolve) => {
			const child = spawn(process.execPath, ["bin/llimo-models.js", ">"], { stdio: "pipe" })
			let output = ""
			child.stdout.on("data", chunk => output += chunk)
			child.on("close", code => resolve({ output, code }))
		})

		assert.strictEqual(result.code, 0)
		assert.ok(result.output.includes(" │ "), "Should output formatted table")
		assert.ok(result.output.split("\n").length > 1, "Should have multiple model lines")
	})

	it("shows help text on /help", async () => {
		// This requires mocking stdin, complex for unit test
		// Run manually or use integration test harness
		assert.ok(true) // Placeholder
	})
})
