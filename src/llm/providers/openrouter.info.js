import ModelInfo from "../ModelInfo.js"
import Pricing from "../Pricing.js"

/**
 * @param {object[]} models
 * @returns {ModelInfo[]}
 */
export function makeFlat(models) {
	return models.map(m => {
		const pricing = new Pricing({ ...(m?.pricing ?? {}) })
		pricing.completion *= 1e6
		pricing.prompt *= 1e6
		if (pricing.input_cache_read > 0) pricing.input_cache_read *= 1e6
		if (pricing.input_cache_write > 0) pricing.input_cache_write *= 1e6
		return new ModelInfo({ ...m, provider: "openrouter", pricing })
	})
}

export default {
	makeFlat
}
