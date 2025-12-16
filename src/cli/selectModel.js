import { selectModel } from "../llm/selectModel.js"

/**
 * @param {import("../llm/AI.js").default} ai
 * @param {import("./Ui.js").Ui} ui
 * @param {string} modelStr
 * @param {string} providerStr
 * @param {(chosen: import("../llm/ModelInfo.js").default) => void} [onSelect]   Current chat instance
 * @returns {Promise<import("../llm/ModelInfo.js").default>}
 */
export async function selectAndShowModel(ai, ui, modelStr, providerStr, onSelect = () => { }, options = {}) {
	const {
		fast = false,
		quickModel = "qwen-3-235b-a22b-instruct-2507"
	} = options
	const DEFAULT_MODEL = "gpt-oss-120b:free"
	/** @type {import("../llm/ModelInfo.js").default} */
	let model
	if (fast) {
		// Force quickModel with fastest provider (cerebras or huggingface)
		model = ai.getModel(quickModel + ":cerebras") || ai.getModel(quickModel + ":huggingface")
		if (model) {
			onSelect(model)
			ui.console.info(`> ${model.id} selected with fastest server`)
			return model
		} else {
			ui.console.warn(`Fast model ${quickModel} not available with fast providers`)
		}
	}
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

	// Validate API key before proceeding
	try {
		ai.getProvider(model.provider)
	} catch (/** @type {any} */ err) {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	}

	// Show model & provider info
	const inputPer1MT = parseFloat(String(model.pricing?.prompt ?? 0)) * 1e6
	const outputPer1MT = parseFloat(String(model.pricing?.completion ?? 0)) * 1e6
	const cachePer1MT = parseFloat(String(model.pricing?.input_cache_read ?? 0)) + parseFloat(String(model.pricing?.input_cache_write ?? 0))
	const pricing = ui.formats.pricing

	ui.console.info(`> ${model.id} selected with modality ${model.architecture?.modality ?? "?"}`)
	ui.console.info(`  pricing: → ${pricing(inputPer1MT)} ← ${pricing(outputPer1MT)} (cache: ${pricing(cachePer1MT)})`)
	ui.console.info(`  provider: ${model.provider}`)
	return model
}

