/**
 * ModelProvider – fetches model metadata from supported providers and caches it.
 *
 * Each provider has its own endpoint that returns a list of available models.
 * The result is stored in a JSON file under the project cache directory so that
 * subsequent calls within the cache TTL do not hit the network.
 *
 * The public API:
 *   - `getAll()` – returns a `Map<string, import("./AI.js").ModelInfo>`
 *     with the union of all provider models (local + remote).
 *
 * @module llm/ModelProvider
 */
import { FileSystem } from "../utils.js"
import path from "node:path"

import getCerebrasInfo from "./providers/cerebras.info.js"

/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */

/** Cache duration – 1 hour (in milliseconds) */
const CACHE_TTL = 60 * 60 * 1000

/** Default cache location – inside the project root */
const CACHE_DIR = ".cache"
const CACHE_FILE = "models.json"

export default class ModelProvider {
	/** @type {FileSystem} */
	#fs
	/** @type {string} absolute path to the cache file */
	#cachePath

	constructor() {
		this.#fs = new FileSystem()
		// Resolve the cache file relative to the current working directory.
		this.#cachePath = path.resolve(CACHE_DIR, CACHE_FILE)
	}

	/**
	 * Load the cache file if it exists and is fresh.
	 * @returns {Promise<{ timestamp:number, data:any } | null>}
	 */
	async #loadCache() {
		if (await this.#fs.access(this.#cachePath)) {
			const raw = await this.#fs.readFile(this.#cachePath, "utf-8")
			try {
				const parsed = JSON.parse(raw)
				if (
					typeof parsed.timestamp === "number" &&
					(Date.now() - parsed.timestamp) < CACHE_TTL
				) {
					return parsed
				}
			} catch {/* ignore malformed cache */ }
		}
		return null
	}

	/**
	 * Write fresh data to the cache.
	 * @param {any} data
	 */
	async #writeCache(data) {
		await this.#fs.save(this.#cachePath, { timestamp: Date.now(), data })
	}

	/**
	 * Fetch model list from a provider endpoint.
	 *
	 * The function knows how to call each supported provider.
	 *
	 * @param {AvailableProvider} provider
	 * @returns {Promise<Array<import("./AI.js").ModelInfo>>}
	 */
	async #fetchFromProvider(provider) {
		switch (provider) {
			case "cerebras":
				// Real Cerebras endpoint – requires an Authorization header.
				return await this.#jsonFetch(`https://api.cerebras.ai/v1/models`, {
					Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`
				})
			case "openrouter":
				// OpenRouter model list endpoint – public for most models.
				return await this.#jsonFetch(`https://openrouter.ai/api/v1/models`)
			case "huggingface":
				// HuggingFace inference endpoint – placeholder (public list not provided).
				// Returning empty array is safe; callers will rely on static fallback models.
				return []
			default:
				throw new Error(`Unsupported provider "${provider}"`)
		}
	}

	/**
	 * Generic JSON fetch – uses native fetch (Node ≥ 18) and validates response.
	 * Adds provider‑specific headers (e.g. Authorization for Cerebras).
	 *
	 * @param {string} url
	 * @param {object} [headers={}]
	 * @returns {Promise<Array>}
	 */
	async #jsonFetch(url, headers = {}) {
		const resp = await fetch(url, { headers: { ...headers, "Accept": "application/json" } })
		if (!resp.ok) {
			throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`)
		}
		const json = await resp.json()
		// Providers may return an array directly or wrap it in a property.
		if (Array.isArray(json)) return json
		if (Array.isArray(json.data)) return json.data
		if (Array.isArray(json.models)) return json.models
		// Fallback to empty array – caller will handle absence gracefully.
		return []
	}

	/**
	 * Normalise raw provider payload into the common ModelInfo shape.
	 *
	 * @param {Partial<import("./AI.js").ModelInfo>} item Raw model object from provider.
	 * @param {AvailableProvider} provider Provider name.
	 * @param {Array<readonly [string, Partial<import("./AI.js").ModelInfo>]>} [models=[]]
	 * @returns {Partial<import("./AI.js").ModelInfo>}
	*/
	#normalise(item, provider, models = []) {
		/** @type {Map<string, Partial<import("./AI.js").ModelInfo>>} */
		const map = new Map(models)
		const name = String(item.id ?? "")
		/** @type {Partial<import("./AI.js").ModelInfo>} */
		const base = map.get(name) ?? {}
		/** @type {Partial<import("./AI.js").ModelInfo>} */
		const norm = { ...base, ...item }
		switch (provider) {
			case "cerebras":
				norm.provider = "cerebras"
				break
			case "openrouter":
				// OpenRouter uses *_usd naming.
				norm.provider = "openrouter"
				break
			case "huggingface":
				// HuggingFace payload format (if ever used) – fallback to generic names.
				norm.provider = "huggingface"
				break
		}
		return norm
	}

	/**
	 * Return a map of model-id → model-info.
	 *
	 * The method first attempts to read a fresh cache. If the cache is missing
	 * or stale it performs network requests, updates the cache and returns the
	 * merged data.
	 * @param {object} options
	 * @param {(name: string, providers: string[]) => void} [options.onBefore]
	 * @param {(name: string, raw: any, models: Partial<import("./AI.js").ModelInfo>[]) => void} [options.onData]
	 *
	 * @returns {Promise<Map<string, import("./AI.js").ModelInfo>>}
	 */
	async getAll(options = {}) {
		const {
			onBefore = () => { },
			onData = () => { },
		} = options
		const cached = await this.#loadCache()
		if (cached) {
			return new Map(cached.data.map((m) => [m.id, m]))
		}

		/** @type {AvailableProvider[]} */
		const providerNames = ["cerebras", "openrouter", "huggingface"]
		const all = []

		for (const name of providerNames) {
			try {
				onBefore(name, providerNames)
				const raw = await this.#fetchFromProvider(name)
				let predefined = {}
				if ("cerebras" === name) {
					predefined = getCerebrasInfo()
				}

				const normalized = raw.map((item) => this.#normalise(item, name, predefined.models ?? []))
				onData(name, raw, normalized)
				all.push(...normalized)
			} catch (e) {
				// Swallow network errors – the cache will be empty and callers can
				// continue to use statically known models.
				console.warn(`⚠️  Failed to fetch models from ${name}: ${e.message}`)
			}
		}

		if (all.length) {
			await this.#writeCache(all)
		}

		/** @todo fix: Type 'Map<string | undefined, Partial<ModelInfo>>' is not assignable to type 'Map<string, ModelInfo>'.
				Type 'string | undefined' is not assignable to type 'string'.
					Type 'undefined' is not assigned to type 'string'.ts(2322) */
		// Ensure we only include entries with a defined string id.
		const cleanEntries = all
			.filter((m) => typeof m.id === "string" && m.id.length > 0)
			.map((m) => [m.id, m])

		return new Map(cleanEntries)
	}
}
