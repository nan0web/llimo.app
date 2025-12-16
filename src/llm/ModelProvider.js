/**
 * ModelProvider – fetches model metadata from supported providers and caches it.
 *
 * Each provider has its own endpoint that returns a list of available models.
 * The result is stored in a JSON file under the project cache directory so that
 * subsequent calls within the cache TTL do not hit the network.
 *
 * The public API:
 *   - `getAll()` – returns a `Map<string, ModelInfo>`
 *     with the union of all provider models (local + remote).
 *
 * @module llm/ModelProvider
 */
import { FileSystem } from "../utils/index.js"

import getCerebrasInfo from "./providers/cerebras.info.js"
import getHuggingFaceInfo from "./providers/huggingface.info.js"
import ModelInfo from "./ModelInfo.js"

/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */

/** Cache duration – 1 hour (in milliseconds) */
const CACHE_TTL = 60 * 60 * 1000

/** Default cache location – inside the project root */
const CACHE_FILE = "chat/models.jsonl"

export default class ModelProvider {
	/** @type {FileSystem} */
	#fs
	/** @type {string} absolute path to the cache file */
	#cachePath

	constructor() {
		this.#fs = new FileSystem()
		// Resolve the cache file relative to the current working directory.
		this.#cachePath = this.#fs.path.resolve(CACHE_FILE)
	}

	/**
	 * Load the cache file if it exists and is fresh.
	 * @returns {Promise<any | null>}
	 */
	async #loadCache() {
		if (await this.#fs.access(this.#cachePath)) {
			const rows = await this.#fs.load(this.#cachePath) ?? []
			const stats = await this.#fs.info(this.#cachePath)
			if ((Date.now() - stats.mtimeMs) < CACHE_TTL) {
				return rows.map(m => new ModelInfo(m))
			}
		}
		return null
	}

	/**
	 * Write fresh data to the cache.
	 * @param {any} data
	 */
	async #writeCache(data) {
		await this.#fs.save(this.#cachePath, data)
	}

	/**
	 * Fetch model list from a provider endpoint.
	 *
	 * The function knows how to call each supported provider.
	 *
	 * @param {AvailableProvider} provider
	 * @returns {Promise<Array<ModelInfo>>}
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
				// HuggingFace inference providers – model list via router API
				// This returns both the base HF models and partner models.
				// See: https://huggingface.co/docs/api-inference/models
				return await this.#jsonFetch(
					"https://router.huggingface.co/v1/models",
					{
						Authorization: `Bearer ${process.env.HF_TOKEN}`
					}
				)
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
	 * @param {Partial<ModelInfo> & {model_id: string} | ModelInfo} item Raw model object from provider.
	 * @param {AvailableProvider} provider Provider name.
	 * @param {Array<readonly [string, Partial<ModelInfo>]>} [models=[]]
	 * @returns {Partial<ModelInfo>}
	*/
	#normalise(item, provider, models = []) {
		/** @type {Map<string, Partial<ModelInfo>>} */
		const map = new Map(models)
		const name = String(item.id ?? item['model_id'] ?? "")
		/** @type {Partial<ModelInfo>} */
		const base = map.get(name) ?? {}
		/** @type {Partial<ModelInfo>} */
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
				// HuggingFace inference API uses unique format – ensure correct provider tag.
				norm.provider = "huggingface"
				break
		}
		// Map HuggingFace's provider-suffixed models like "openai/gpt-oss-120b:groq"
		if (provider === "huggingface" && typeof norm.id === "string") {
			// Remove provider suffix like ":groq"
			norm.id = norm.id.split(":")[0]
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
	 * @param {(name: string, raw: any, models: Partial<ModelInfo>[]) => void} [options.onData]
	 *
	 * @returns {Promise<Map<string, ModelInfo[]>>}
	 */
	async getAll(options = {}) {
		/**
		 * @param {ModelInfo[]} all
		 * @returns {Map<string, ModelInfo[]>}
		 */
		const convertMap = (all) => {
			const map = new Map()
			all
				.filter((m) => typeof m.id === "string" && m.id.length > 0)
				.forEach((m) => {
					const arr = map.get(m.id) ?? []
					arr.push(m)
					map.set(m.id, arr)
				})
			return map
		}
		const {
			onBefore = () => { },
			onData = () => { },
		} = options
		/** @type {ModelInfo[]} */
		const cached = await this.#loadCache()
		if (cached) {
			return convertMap(cached)
		}

		/** @type {AvailableProvider[]} */
		const providerNames = ["cerebras", "openrouter", "huggingface"]
		const all = []

		for (const name of providerNames) {
			try {
				onBefore(name, providerNames)
				let raw = []
				let predefined = {}
				if (name === "cerebras") {
					predefined = getCerebrasInfo()
				} else if (name === "huggingface") {
					// Use static fallback models as a base, then merge remote results.
					predefined = getHuggingFaceInfo()
				}
				raw = await this.#fetchFromProvider(name)

				const normalized = raw.map((item) => this.#normalise(item, name, predefined.models ?? []))
				const flat = this.#makeFlat(normalized)
				onData(name, raw, flat)
				all.push(...flat)
			} catch (/** @type {any} */ err) {
				// Swallow network errors – the cache will be empty and callers can
				// continue to use statically known models.
				console.warn(`⚠️  Failed to fetch models from ${name}: ${err.message}`)
			}
		}

		if (all.length) {
			await this.#writeCache(all)
		}

		// Ensure we only include entries with a defined string id.
		return convertMap(all)
	}

	#makeFlat(arr) {
		const result = []
		for (const model of arr) {
			if (model.providers) {
				for (const opts of model.providers) {
					const provider = model.provider + "/" + (opts.provider ?? "")
					if (provider.endsWith("/")) {
						console.warn("Incorrect model's provider: " + provider)
					}
					const { providers, ...rest } = model
					const flat = new ModelInfo({ ...rest, ...opts, provider })
					result.push(flat)
				}
			} else {
				result.push(model)
			}
		}
		return result
	}
}

