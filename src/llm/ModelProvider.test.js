import { describe, it, beforeEach, mock, afterEach } from "node:test"
import assert from "node:assert/strict"
import ModelProvider from "./ModelProvider.js"
import { FileSystem } from "../utils/index.js"
import ModelInfo from "./ModelInfo.js"

class TestFileSystem extends FileSystem {
	#logs = []
	/** @type {Map<string, any>} */
	#data
	/**
	 *
	 * @param {Partial<FileSystem> & { data: readonly<[ string, any ]> | Map<string, any> }} input
	 */
	constructor(input = {}) {
		const {
			data = [],
			...rest
		} = input
		super(rest)
		const temp = new Map(data)
		this.#data = new Map()
		temp.forEach((value, path) => {
			this.#data.set(this.path.normalize(path), value)
		})
	}
	norm
	/**
	 * @param {string} path
	 * @returns {Promise<boolean>}
	 */
	async access(path) {
		this.#logs.push(["access", { path }])
		return true
	}
	/**
	 * @param {string} path
	 * @param {BufferEncoding} encoding
	 * @returns {Promise<any>}
	 */
	async load(path, encoding) {
		const rel = this.path.normalize(path)
		if (this.#data.has(rel)) {
			return this.#data.get(rel)
		}
	}
	/**
	 * Sets the #data value for path.
	 * @param {string} path
	 * @param {any} [data]
	 * @param {any} [options]
	 * @returns {Promise<void>}
	 */
	async save(path, data, options) {
		this.#data.set(this.path.normalize(path), data)
	}
	/**
	 * @param {string} path
	 * @returns {Promise<import("node:fs").Stats>>}
	 */
	async info(path) {
		const rel = this.path.normalize(path)
		const exists = this.#data.has(rel)
		const size = exists ? JSON.stringify(this.#data.get(rel)).length : 0
		const now = exists ? Date.now() : 0
		return {
			isFile: () => exists,
			size,
			ctimeMs: now,
			atimeMs: now,
			mtimeMs: now,
		}
	}
}

// Mock static info functions.
const mockHFInfo = [["test-model", { context_length: 8192, pricing: { prompt: 0.1 } }]]
const mockCerebrasInfo = [["cerebras-test", { context_length: 4096, provider: "cerebras" }]]

describe("ModelProvider", () => {
	/** @type {ModelProvider} */
	let provider
	let mockFS
	let mockFetch

	beforeEach(() => {
		mockFS = new FileSystem()
		provider = new ModelProvider({ fs: mockFS })
		// Mock fetch globally.
		mockFetch = mock.fn(async () => ({ json: async () => [] }))
		global.fetch = mockFetch
		// Mock static imports.
		// mock.doMock("./providers/huggingface.info.js", () => ({ models: mockHFInfo }))
		// mock.doMock("./providers/cerebras.info.js", () => ({ models: mockCerebrasInfo }))
		// Mock FS for cache.
		mock.method(mockFS, "access", async () => false)
		mock.method(mockFS, "load", async () => null)
		mock.method(mockFS, "save", async () => { })
		mock.method(mockFS, "info", async () => ({ mtimeMs: 0 }))
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
		it("loads fresh cache if within TTL", async () => {
			const fs = new TestFileSystem({
				data: [
					["chat/cache/cerebras.jsonl", [
						{ id: "gpt-oss-120b", provider: "cerebras" },
					]],
					["chat/cache/openrouter.jsonl", [
						{ id: "qwen-3-480b", provider: "openrouter" },
					]],
				]
			})
			const provider = new ModelProvider({ fs })

			const cerebras = await provider.loadCache('cerebras')
			assert.strictEqual(cerebras.length, 1)
			assert.ok(cerebras[0] instanceof ModelInfo)
			assert.deepStrictEqual(cerebras.map(m => [m.id, m.provider, m.context_length]), [
				["gpt-oss-120b", "cerebras", 0],
			])
			const openrouter = await provider.loadCache('openrouter')
			assert.strictEqual(openrouter.length, 1)
			assert.ok(openrouter[0] instanceof ModelInfo)
			assert.deepStrictEqual(openrouter.map(m => [m.id, m.provider, m.context_length]), [
				["qwen-3-480b", "openrouter", 0],
			])
		})

		it("ignores stale cache beyond TTL", async () => {
			const fs = new TestFileSystem({
				data: [
					["chat/models.jsonl", [
						{ id: "gpt-oss-120b", provider: "cerebras" },
						{ id: "qwen-3-480b", provider: "openrouter" },
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

			const result = await provider.loadCache()
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

		it("returns empty map from stale/no cache, uses static on fetch fail", async () => {
			// Simulate all fetches failing.
			provider.fetch = async () => { throw new Error("fetch fail") }

			const result = await provider.getAll()
			assert.ok(result instanceof Map)
			assert.ok(result.size > 0, "Should include static models from HF/Cerebras") // From mocks.
		})

		it("merges fetched data with static fallbacks", async () => {
			provider.loadCache = async () => null
			provider.fetch = async (url, options) => {
				if (url.includes("huggingface")) {
					return { ok: true, json: async () => [{ id: "fetched-hf", context_length: 8192 }] }
				}
				return { ok: true, json: async () => [] }
			}

			const result = await provider.getAll()
			const entry = [...result.values()][0]
			assert.equal(entry.provider, "huggingface")
			assert.equal(entry.id, "fetched-hf")
			assert.equal(entry.context_length, 8192)
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
})

