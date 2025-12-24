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
import Pricing from "./Pricing.js"

/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */

/** Cache duration – 1 hour (in milliseconds) */
const CACHE_TTL = 60 * 60 * 1000

/** Default cache location – inside the project root */
const CACHE_FILE = "chat/cache/{provider}.jsonl"

export default class ModelProvider {
	/** @type {FileSystem} */
	#fs
	/** @type {string} absolute path to the cache file */
	#cachePath

	constructor(input = {}) {
		const {
			fs = new FileSystem(),
		} = input
		this.#fs = fs
		// Resolve the cache file relative to the current working directory.
		this.#cachePath = this.#fs.path.resolve(CACHE_FILE)
	}

	get cachePath() {
		return this.#cachePath
	}

	/**
	 * Load the cache file if it exists and is fresh.
	 * @param {string} provider
	 * @returns {Promise<ModelInfo[] | null>}
	 */
	async loadCache(provider) {
		const file = this.#cachePath.replaceAll("{provider}", provider)
		// const rel = this.#fs.path.relative(this.#fs.cwd, file)
		try {
			if (await this.#fs.access(file)) {
				const rows = await this.#fs.load(file) ?? []
				if (!rows.length) return null
				const stats = await this.#fs.info(file)
				if ((Date.now() - stats.mtimeMs) < CACHE_TTL) {
					return rows.map(row => new ModelInfo(row))
				}
			}
		} catch (/** @type {any} */ err) {
			// Ignore cache read errors – fall back to fresh fetch.
			console.debug(`Cache load failed: ${err.message}`)
		}
		return null
	}

	/**
	 * Write fresh data to the cache as JSONL (one model per line).
	 * @param {any} data
	 * @param {string} provider
	 */
	async writeCache(data, provider) {
		const file = this.#cachePath.replaceAll("{provider}", provider)
		await this.#fs.save(file, data)
	}

	/**
	 * Fetch model list from a provider endpoint.
	 *
	 * The function knows how to call each supported provider.
	 *
	 * @param {AvailableProvider} provider
	 * @returns {Promise<Array<Partial<ModelInfo> & {id: string}>>} Raw model data.
	 */
	async fetchFromProvider(provider) {
		switch (provider) {
			case "cerebras":
				if (!process.env.CEREBRAS_API_KEY) {
					throw new Error("CEREBRAS_API_KEY required for Cerebras models")
				}
				return await this.#jsonFetch(`https://api.cerebras.ai/v1/models`, {
					Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`
				})
			case "openrouter":
				if (!process.env.OPENROUTER_API_KEY) {
					throw new Error("OPENROUTER_API_KEY required for OpenRouter models")
				}
				return await this.#jsonFetch(`https://openrouter.ai/api/v1/models`, {
					Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
				})
			case "huggingface":
				const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY
				if (!HF_TOKEN) {
					throw new Error("HF_TOKEN required for Hugging Face models")
				}
				// Note: Hugging Face router API may not provide full model list; fallback to static.
				// Endpoint for inference models: https://huggingface.co/docs/api-inference/models
				try {
					return await this.#jsonFetch(
						"https://router.huggingface.co/v1/models",
						{ Authorization: `Bearer ${HF_TOKEN}` }
					)
				} catch (err) {
					console.debug(`HF fetch failed, using static: ${err.message}`)
					return [] // Fallback to static info only.
				}
			default:
				throw new Error(`Unsupported provider "${provider}"`)
		}
	}

	/**
	 *
	 * @param {string | URL | globalThis.Request} url
	 * @param {RequestInit} options
	 * @returns {Promise<Response>}
	 */
	async fetch(url, options) {
		return await fetch(url, options)
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
		const resp = await this.fetch(url, { headers: { ...headers, "Accept": "application/json" } })
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
	 * Flatten multi-provider entries into separate ModelInfo instances.
	 * @param {Array<ModelInfo & { providers?: Partial<ModelInfo> }>} arr
	 * @param {AvailableProvider} provider
	 * @param {Array<[string, Partial<ModelInfo>]>} [predefined]
	 * @returns {ModelInfo[]}
	 */
	_makeFlat(arr, provider, predefined = []) {
		const map = new Map(predefined)
		const result = []
		const push = item => {
			if (item) {
				if ("openrouter" === provider) {
					this.#multiply(item, 1e6)
				}
				result.push(item)
			}
		}
		for (const model of arr) {
			const pre = map.get(model.id) ?? {}
			if (model.providers && Array.isArray(model.providers)) {
				for (const opts of model.providers) {
					const pro = provider + "/" + (opts.provider ?? "")
					if (pro.endsWith("/")) {
						console.warn("Incorrect model's provider: " + pro)
						continue
					}
					const { providers, ...rest } = model
					push(new ModelInfo({ ...pre, ...rest, ...opts, provider: pro }))
				}
			} else {
				push(new ModelInfo({ ...pre, ...model, provider: provider ?? model.provider }))
			}
		}
		return result
	}

	/**
	 *
	 * @param {ModelInfo} model
	 * @param {number} rate
	 */
	#multiply(model, rate = 1) {
		const fields = [
			"completion",
			"input_cache_read",
			"input_cache_write",
			"internal_reasoning",
			"prompt",
		]
		model.pricing ??= new Pricing({})
		for (const field of fields) {
			if (model.pricing[field] > 0) {
				model.pricing[field] *= rate
			}
		}
		return model
	}

	/**
	 * Return a map of model-id → array of ModelInfo (one per provider variant).
	 *
	 * Attempts cache first. If stale/missing, fetches from providers, merges with static info,
	 * updates cache, and returns. Errors per-provider are swallowed, falling back to static.
	 *
	 * @param {object} [options={}]
	 * @param {function(string, string[]): void} [options.onBefore] Called before fetch.
	 * @param {function(string, any, ModelInfo[]): void} [options.onData] Called after normalization.
	 * @param {boolean} [options.noCache]
	 * @returns {Promise<Map<string, ModelInfo>>}
	 */
	async getAll(options = {}) {
		/**
		 * @param {ModelInfo[]} all
		 * @returns {Map<string, ModelInfo>}
		 */
		const convertMap = (all) => {
			const map = new Map()
			all
				.filter((m) => typeof m.id === "string" && m.id.length > 0)
				.forEach((m) => {
					const id = [m.id, m.provider].join("@")
					map.set(id, m)
				})
			return map
		}

		const {
			onBefore = () => { },
			onData = () => { },
			noCache = false,
		} = options

		/** @type {AvailableProvider[]} */
		const providerNames = ["cerebras", "openrouter", "huggingface"]
		const all = []

		for (const name of providerNames) {
			try {
				onBefore(name, providerNames)
				let raw = []
				// Fetch if possible, else use static only.
				try {
					// Try cache first.
					const cached = noCache ? null : await this.loadCache(name)
					raw = cached ?? await this.fetchFromProvider(name)
					if (!noCache) await this.writeCache(raw, name)
				} catch (/** @type {any} */ err) {
					console.warn(`Fetch failed for ${name}, using static: ${err.message}`)
					raw = [] // Rely on predefined.
				}

				const flat = this.flatten(raw, name)
				onData(name, raw, flat)
				all.push(...flat)
			} catch (/** @type {any} */ err) {
				console.warn(`Failed to process ${name}: ${err.message}`)
			}
		}

		return convertMap(all)
	}

	/**
	 * @param {Array} raw
	 * @param {AvailableProvider} name
	 */
	flatten(raw, name) {
		let predefined = []

		// Load static info for providers with fallbacks.
		if (name === "cerebras") {
			predefined = getCerebrasInfo()?.models ?? [] // Assume returns Array<[string, Partial<ModelInfo>]>
		} else if (name === "huggingface") {
			predefined = getHuggingFaceInfo()?.models ?? [] // Array<[string, Partial<ModelInfo>]>
		}

		return this._makeFlat(raw, name, predefined)
	}
}

