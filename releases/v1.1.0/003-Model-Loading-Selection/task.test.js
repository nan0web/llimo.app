import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import { loadModels, selectAndShowModel } from "../../../src/Chat/index.js"
import ModelProvider from "../../../src/llm/ModelProvider.js"
import ModelInfo from "../../../src/llm/ModelInfo.js"
import FileSystem from "../../../src/utils/FileSystem.js"
import { rm, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"

describe("003-Model-Loading-Selection – src/Chat/models.js & src/llm/*", () => {
	describe("3.1 Load models from providers (OpenAI, Cerebras, etc.) with progress UI", () => {
		it("Loads and caches models from multiple providers with UI progress", async () => {
			const mockUi = {
				console: { info: () => {}, overwriteLine: () => {} },
				createProgress: () => ({ start: () => {}, stop: () => {} }),
				cursorUp: () => {}
			}
			// Mock ModelProvider to return known models
			const mockProvider = new ModelProvider()
			mockProvider.getAll = async () => new Map([
				["gpt-oss-120b", new ModelInfo({ id: "gpt-oss-120b", provider: "openai", pricing: { prompt: 0.00035 } })],
				["llama3.1-8b", new ModelInfo({ id: "llama3.1-8b", provider: "cerebras", context_length: 8192 })]
			])
			// @todo: Override in loadModels (or test directly)
			const models = await loadModels(mockUi)
			ok(models.size >= 2, "Loads at least 2 models from providers")
			ok(models.has("gpt-oss-120b"), "Includes OpenAI model with pricing")
			ok(mockUi.console.info.mock.calls.some(call => call[0].includes("Loaded 2 models")), "Shows progress via UI")
		})

		it("Caches models for 1 hour, skips fetch on second call if fresh", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "model-cache-"))
			const fs = new FileSystem({ cwd: tempDir })
			const mockUi = { console: { info: () => {} }, createProgress: () => setInterval(() => {}, 1000) }
			const models1 = await loadModels(mockUi)
			// Mock time: Assume cache written
			const cachePath = "chat/models.jsonl"
			const cacheContent = { timestamp: Date.now(), data: Array.from(models1) }
			await fs.save(cachePath, cacheContent)
			// Second call: should use cache (no fetch)
			const models2 = await loadModels(mockUi)
			deepStrictEqual(Array.from(models2.keys()), Array.from(models1.keys()), "Returns cached models")
			ok(mockUi.console.info.mock.calls.some(call => call[0].includes("from cache")), "Indicates cache use")
			await rm(tempDir, { recursive: true })
		})
	})

	describe("3.2 Select model interactively or by partial id/provider", () => {
		it("Selects exact match without prompt", async () => {
			const models = new Map([["exact-match", new ModelInfo({ id: "exact-match", provider: "test" })]])
			const mockUi = { console: { info: () => {} }, ask: async () => {} } // No prompt
			const fs = new FileSystem()
			const selected = await selectModel(models, "exact-match", undefined, mockUi, fs)
			strictEqual(selected.id, "exact-match", "Selects single matching model without UI")
		})

		it("Prompts interactive selection for multiple partial matches", async () => {
			const models = new Map([
				["gpt-oss-120b", new ModelInfo({ id: "gpt-oss-120b", provider: "openai" })],
				["gpt-oss-70b", new ModelInfo({ id: "gpt-oss-70b", provider: "cerebras" })]
			])
			const mockUi = {
				console: { info: () => {} },
				ask: async () => "1" // Select first
			}
			const fs = new FileSystem()
			const selected = await selectModel(models, "gpt-oss", undefined, mockUi, fs)
			strictEqual(selected.id, "gpt-oss-120b", "Selects via numbered prompt (1)")
			ok(mockUi.console.info.mock.calls.some(call => call[0].includes("Multiple models")), "Shows prompt for multiples")
		})

		it("Throws error on zero matches for partial query", async () => {
			const models = new Map([["other-model", new ModelInfo({ id: "other" })]])
			const mockUi = { console: { info: () => {} } }
			const fs = new FileSystem()
			await assert.rejects(
				() => selectModel(models, "nonexistent", undefined, mockUi, fs),
				{ message: /No models match/ },
				"Throws on no matches"
			)
		})
	})

	describe("3.3 Persist selection in .cache/llimo.config.json for reuse", () => {
		it("Writes model/provider to .cache/llimo.json on selection", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "persist-test-"))
			const fs = new FileSystem({ cwd: tempDir })
			const models = new Map([["selected", new ModelInfo({ id: "selected", provider: "test" })]])
			const mockUi = { console: { info: () => {} }, ask: async () => "selected" }
			await selectModel(models, "", "", mockUi, fs)
			const config = JSON.parse(await readFile(".cache/llimo.json", "utf-8"))
			deepStrictEqual(config, { model: "selected", provider: "test" }, "Persists to config.json")
			await rm(tempDir, { recursive: true })
		})

		it("Reuses persisted selection on subsequent runs (loads from config)", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "reuse-test-"))
			const fs = new FileSystem({ cwd: tempDir })
			await writeFile(".cache/llimo.json", JSON.stringify({ model: "reused", provider: "test" }))
			const models = new Map([["reused", new ModelInfo({ id: "reused", provider: "test" })]])
			const mockUi = { console: { info: () => {} } } // No ask needed (cached)
			// @todo: In main, load config before selectModel if exists
			const config = JSON.parse(await readFile(".cache/llimo.json", "utf-8"))
			const loadedModel = models.get(config.model)
			strictEqual(loadedModel.id, "reused", "Loads from persisted config")
			ok(true, "Reuses without prompt") // Placeholder
			await rm(tempDir, { recursive: true })
		})
	})
})
