/**
 * Supported Models
 *
 * Production Models
 *
 * Model Name          Model ID                                 Parameters   Speed (tokens/s)   $ Input /M   $ Output /M
 * -----------------------------------------------------------------------------------------------
 * Llama 3.1 8B       llama3.1-8b                              8 B          ~2200               0.10         0.10
 * Llama 3.3 70B      llama-3.3-70b                            70 B         ~2100               0.85         1.20
 * OpenAI GPT OSS     gpt-oss-120b                             120 B        ~3000               0.35         0.75
 * Qwen 3 32B         qwen-3-32b                               32 B         ~2600               0.40         0.80
 *
 * Preview Models
 *
 * Model Name                          Model ID                                         Parameters   Speed (tokens/s)   $ Input /M   $ Output /M
 * ---------------------------------------------------------------------------------------------------------------
 * Qwen 3 235B Instruct                qwen-3-235b-a22b-instruct-2507                  235 B        ~1400               0.60         1.20
 * Z.ai GLM 4.6 1                      zai-glm-4.6                                      357 B        ~1000               2.25         2.75
 *
 * The values above are the source of truth for the static model catalogue
 * used by the `cerebras.info` provider.
 */

import ModelInfo from "../ModelInfo.js"
import Pricing from "../Pricing.js"

/** @type {{ models: Array<[string, Partial<ModelInfo>]> }} */
const free = {
	models: [
		[
			"gpt-oss-120b",
			{
				context_length: 65000,
				limits: {
					tpm: 60e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 30,
					rph: 900,
					rpd: 14.4e3,
				},
				/** Parameters amount (tokens) */
				parameters: 120e9,
				/** Approx. speed in tokens per second */
				speed: 3e3,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
		[
			"llama3.1-8b",
			{
				limits: {
					tpm: 60e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 30,
					rph: 900,
					rpd: 14.4e3,
				},
				parameters: 8e9,
				speed: 2200,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
		[
			"llama-3.3-70b",
			{
				limits: {
					tpm: 60e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 30,
					rph: 900,
					rpd: 14.4e3,
				},
				parameters: 70e9,
				speed: 2100,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
		[
			"qwen-3-32b",
			{
				context_length: 65000,
				limits: {
					tpm: 60e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 30,
					rph: 900,
					rpd: 14.4e3,
				},
				parameters: 32e9,
				speed: 2600,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
		[
			"qwen-3-235b-a22b-instruct-2507",
			{
				context_length: 65000,
				limits: {
					tpm: 60e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 30,
					rph: 900,
					rpd: 14.4e3,
				},
				parameters: 235e9,
				speed: 1400,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
		[
			"zai-glm-4.6",
			{
				context_length: 65000,
				limits: {
					tpm: 150e3,
					tph: 1e6,
					tpd: 1e6,
					rpm: 10,
					rph: 100,
					rpd: 100,
				},
				parameters: 357e9,
				speed: 1000,
				/** Pricing per 1M tokens - FREE */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
			},
		],
	],
}

/**
 * @type {{ models: Array<readonly [string, Partial<import("../AI").ModelInfo>]> }}
 */
const developer = {
	models: [
		[
			"gpt-oss-120b",
			{
				limits: { tpm: 1e6, rpm: 1e3 },
				parameters: 120e9,
				speed: 3000,
				pricing: { prompt: 0.35, completion: 0.75, input_cache_read: 0.10 },
			},
		],
		[
			"llama3.1-8b",
			{
				limits: { tpm: 1e6, rpm: 1e3 },
				parameters: 8e9,
				speed: 2200,
				pricing: { prompt: 0.10, completion: 0.10, input_cache_read: 0.10 },
			},
		],
		[
			"llama-3.3-70b",
			{
				limits: { tpm: 1e6, rpm: 1e3 },
				parameters: 70e9,
				speed: 2100,
				pricing: { prompt: 0.85, completion: 1.20, input_cache_read: 0.10 },
			},
		],
		[
			"qwen-3-32b",
			{
				limits: { tpm: 1e6, rpm: 1e3 },
				parameters: 32e9,
				speed: 2600,
				pricing: { prompt: 0.40, completion: 0.80, input_cache_read: 0.10 },
			},
		],
		[
			"qwen-3-235b-a22b-instruct-2507",
			{
				limits: { tpm: 1e6, rpm: 1e3 },
				parameters: 235e9,
				speed: 1400,
				pricing: { prompt: 0.60, completion: 1.20, input_cache_read: 0.10 },
			},
		],
		[
			"zai-glm-4.6",
			{
				limits: { tpm: 250e3, rpm: 250 },
				parameters: 357e9,
				speed: 1000,
				pricing: { prompt: 2.25, completion: 2.75, input_cache_read: 0.10 },
			},
		],
	],
}

const pro = {}

const max = {}

/**
 * @param {object[]} models
 * @returns {ModelInfo[]}
 */
export function makeFlat(models) {
	return models.map(m => new ModelInfo({ ...m, provider: "cerebras", pricing: new Pricing({ prompt: 0, completion: 0 }) }))
}

export default {
	makeFlat
}
