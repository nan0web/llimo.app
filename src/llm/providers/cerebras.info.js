/**
 * Supported Models
 *
 * Production Models
 *
 * Model Name          Model ID                                 volume   Speed (tokens/s)   $ Input /M   $ Output /M
 * -----------------------------------------------------------------------------------------------
 * Llama 3.1 8B       llama3.1-8b                              8 B          ~2200               0.10         0.10
 * Llama 3.3 70B      llama-3.3-70b                            70 B         ~2100               0.85         1.20
 * OpenAI GPT OSS     gpt-oss-120b                             120 B        ~3000               0.35         0.75
 * Qwen 3 32B         qwen-3-32b                               32 B         ~2600               0.40         0.80
 *
 * Preview Models
 *
 * Model Name                          Model ID                                         volume   Speed (tokens/s)   $ Input /M   $ Output /M
 * ---------------------------------------------------------------------------------------------------------------
 * Qwen 3 235B Instruct                qwen-3-235b-a22b-instruct-2507                  235 B        ~1400               0.60         1.20
 * Z.ai GLM 4.6 1                      zai-glm-4.6                                      357 B        ~1000               2.25         2.75
 *
 * The values above are the source of truth for the static model catalogue
 * used by the `cerebras.info` provider.
 */

import { ModelInfo } from "../ModelInfo.js"
import { Pricing } from "../Pricing.js"

/**
 * @param {object[]} models
 * @returns {ModelInfo[]}
 */
function makeFlat(models) {
	return models.map(m => new ModelInfo({
		...m,
		provider: "cerebras",
		pricing: new Pricing(m.pricing || { prompt: 0, completion: 0 })
	}))
}

export default {
	makeFlat
}
