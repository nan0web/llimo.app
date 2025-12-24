import { selectModel } from "../llm/selectModel.js"

/**
 * Pre-selects a model (loads from cache or defaults). If multiple matches,
 * shows the table and prompts. Persists selection to chat.config.model.
 *
 * @param {import("../llm/AI.js").default} ai
 * @param {import("./Ui.js").Ui} ui
 * @param {string} modelStr
 * @param {string} providerStr
 * @param {(chosen: import("../llm/ModelInfo.js").default) => void} [onSelect]   Current chat instance
 * @returns {Promise<import("../llm/ModelInfo.js").default>}
 */
export async function selectAndShowModel(ai, ui, modelStr, providerStr, onSelect = () => { }) {
	const DEFAULT_MODEL = "gpt-oss-120b:free"
	/** @type {import("../llm/ModelInfo.js").default | undefined} */
	let model
	if (modelStr || providerStr) {
		model = await selectModel(ai.getModelsMap(), modelStr, providerStr, ui, onSelect)
	} else {
		const found = ai.findModel(DEFAULT_MODEL)
		if (!found) {
			const modelsList = ai.findModels(DEFAULT_MODEL)
			ui.console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
			if (modelsList.length) {
				ui.console.info("Similar models, specify the model")
				modelsList.forEach(m => ui.console.info(`- ${m.id}`))
			}
			process.exit(1)
		}
		model = found
	}

	if (!model) {
		throw new Error("No model matching your criteria")
	}

	// Validate API key before proceeding
	try {
		ai.getProvider(model.provider)
	} catch (/** @type {any} */ err) {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	}

	// Show model & provider info
	const inputPricePerM = model.pricing?.prompt ?? 0
	const outputPricePerM = model.pricing?.completion ?? 0
	const contextLen = ui.formats.weight("T", model.context_length)
	const maxOutput = model.maximum_output > 0 ? ui.formats.weight("T", model.maximum_output) : contextLen

	// Cache price only if both read/write >0
	let cacheStr = ""
	const cacheRead = model.pricing?.input_cache_read ?? 0
	const cacheWrite = model.pricing?.input_cache_write ?? 0
	if (cacheRead > 0 || cacheWrite > 0) {
		const cachePerM = cacheRead + cacheWrite
		cacheStr = ` (cache: ${ui.formats.pricing(cachePerM)} / 1M)`
	}

	ui.console.info(`> ${model.id} selected with modality ${model.architecture?.modality ?? "?"}`)
	ui.console.info(`  context: ${contextLen} (max output → ${maxOutput})`)
	ui.console.info(`  pricing: → ${ui.formats.money(inputPricePerM, 2)} / 1M ← ${ui.formats.money(outputPricePerM, 2)} / 1M${cacheStr}`)
	ui.console.info(`  provider: ${model.provider}`)
	return model
}

