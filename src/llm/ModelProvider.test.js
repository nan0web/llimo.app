import { before, describe, it, beforeEach, mock, afterEach } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))

import { ModelProvider } from "./ModelProvider.js"
import { ModelInfo } from "./ModelInfo.js"
import { FileSystem } from "../utils/index.js"
import { TestFileSystem } from "../cli/testing/index.js"


describe("ModelProvider", () => {
	/** @type {ModelProvider} */
	let provider
	let mockFS
	let mockFetch
	/** @type {Record<string, object[]>} */
	let cache = {}

	before(async () => {
		const fs = new FileSystem({ cwd: __dirname })
		for (const pro of ModelProvider.AvailableProviders) {
			cache[pro] = await fs.load(`ModelProvider.test.${pro}.jsonl`) ?? []
		}
	})

	beforeEach(() => {
		mockFS = new TestFileSystem({
			data: Object.entries(cache).map(([pro, arr]) => [`chat/cache/${pro}.jsonl`, arr])
		})
		provider = new ModelProvider({ fs: mockFS })
		// Mock fetch globally.
		mockFetch = mock.fn(async () => ({ json: async () => [] }))
		global.fetch = mockFetch
		// Mock static imports.
		// mock.doMock("./providers/huggingface.info.js", () => ({ models: mockHFInfo }))
		// mock.doMock("./providers/cerebras.info.js", () => ({ models: mockCerebrasInfo }))
		// Mock FS for cache.
		// mock.method(mockFS, "access", async () => false)
		// mock.method(mockFS, "load", async () => null)
		// mock.method(mockFS, "save", async () => { })
		// mock.method(mockFS, "info", async () => ({ mtimeMs: 0 }))
	})

	afterEach(() => {
		mock.restoreAll()
		delete global.fetch
	})

	it("initializes with resolved cache path", () => {
		const p = new ModelProvider()
		assert.strictEqual(p.cachePath, new FileSystem().path.resolve("chat/cache/{provider}.jsonl"))
	})

	describe("cache handling", () => {
		for (const pro of ModelProvider.AvailableProviders) {
			it(`loads fresh ${pro} cache if within TTL`, async () => {
				const provider = new ModelProvider({ fs: mockFS })
				const cerebras = await provider.loadCache(pro)
				assert.strictEqual(cerebras.length, 1)
				assert.deepStrictEqual(cerebras[0], cache[pro][0])
			})
		}

		it("ignores stale cache beyond TTL", async () => {
			const fs = new TestFileSystem({
				data: [
					["chat/cache/cerebras.jsonl", [
						{ id: "gpt-oss-120b", provider: "cerebras" },
					]]
				]
			})
			fs.info = async () => ({
				isFile: () => true,
				mtimeMs: 0,
				atimeMs: 0,
				ctimeMs: 0,
			})
			const provider = new ModelProvider({ fs })

			const result = await provider.loadCache("cerebras")
			assert.strictEqual(result, null)
		})

		it("writes cache as JSONL", async () => {
			const mockData = [new ModelInfo({ id: "write-test" })]
			const fs = new TestFileSystem()
			const provider = new ModelProvider({ fs })
			await provider.writeCache(mockData)
			const result = await provider.loadCache()
			assert.equal(result.length, 1)
			assert.equal(result[0].id, "write-test")
		})
	})

	describe("fetchFromProvider", () => {
		it("fetches Cerebras with API key", async () => {
			const provider = new ModelProvider()
			const fetched = []
			provider.fetch = async (url, options) => {
				fetched.push({ url, options })
				return { ok: true, json: async () => [{ id: "cerebras-model" }] }
			}
			process.env.CEREBRAS_API_KEY = "test-key"
			const result = await provider.fetchFromProvider("cerebras")
			assert.deepStrictEqual(result, [{ id: "cerebras-model" }])
		})

		it("throws without API key for Cerebras", async () => {
			delete process.env.CEREBRAS_API_KEY
			const provider = new ModelProvider()
			await assert.rejects(() => provider.fetchFromProvider("cerebras"), /CEREBRAS_API_KEY/)
		})

		it("fetches OpenRouter with API key", async () => {
			// @todo write test the same way as in Cerebras
		})

		it("fetches HuggingFace and falls back to empty on error", async () => {
			// @todo write test the same way as in Cerebras
		})
	})

	describe("_makeFlat", () => {
		it("flattens single models unchanged", () => {
			const input = [new ModelInfo({ id: "single" })]
			const flat = provider._makeFlat(input, "test")
			assert.deepStrictEqual(flat.length, 1)
			assert.ok(flat[0] instanceof ModelInfo)
		})

		it("flattens multi-provider models", () => {
			const multi = {
				id: "multi",
				providers: [
					{ provider: "sub1", pricing: { prompt: 0.1 } },
					{ provider: "sub2", pricing: { prompt: 0.2 } }
				]
			}
			const input = [multi]
			const flat = provider._makeFlat(input, "test")
			assert.strictEqual(flat.length, 2)
			assert.strictEqual(flat[0].provider, "test/sub1")
			assert.strictEqual(flat[1].provider, "test/sub2")
		})
	})

	describe("getAll", () => {
		beforeEach(() => {
			// Ensure clean state for each test
			mockFS = new FileSystem()
			provider = new ModelProvider({ fs: mockFS })
		})

		it("caches and loads on second call", async () => {
			const fs = new TestFileSystem()
			const provider = new ModelProvider({ fs })
			provider.fetch = async () => ({
				ok: true,
				json: async () => [{ id: "gpt-oss-120b", provider: "cerebras" }]
			})
			const first = await provider.getAll()

			const second = await provider.getAll()
			assert.strictEqual(second.size, first.size)
		})

		it("handles onBefore/onData callbacks", async () => {
			const fs = new TestFileSystem()
			const provider = new ModelProvider({ fs })
			const mockBefore = mock.fn()
			const mockData = mock.fn()
			provider.fetch = async () => ({ ok: true, json: async () => [] })

			await provider.getAll({ onBefore: mockBefore, onData: mockData })
			assert.strictEqual(mockBefore.mock.calls.length, 3)
			assert.strictEqual(mockData.mock.calls.length, 3)
		})
	})

	describe("correct data", () => {
		it("should properly load models info", async () => {
			const models = await provider.getAll()
			let model = models.get("gpt-oss-120b@cerebras")
			assert.equal(model.pricing.prompt, 0)
			assert.equal(model.pricing.completion, 0)
			model = models.get("openai/gpt-oss-120b@huggingface/cerebras")
			assert.equal(model.pricing.prompt, 0.25)
			assert.equal(model.pricing.completion, 0.69)
			model = models.get("openai/gpt-5.1-codex-max@openrouter")
			assert.equal(model.pricing.prompt, 1.25)
			assert.equal(model.pricing.completion, 10)
		})
	})
})

