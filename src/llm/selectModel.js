import Ui from "../cli/Ui.js"
import ModelInfo from "./ModelInfo.js"
import FileSystem from "../utils/FileSystem.js"

/**
 * Helper to select a model (and optionally its provider) from a list of
 * {@link ModelInfo} objects based on partial
 * identifiers supplied on the CLI.
 *
 * The function:
 *   1. Filters the supplied `models` map by the optional `modelPartial`
 *      and `providerPartial` strings (case‑insensitive `includes`).
 *   2. Handles three outcomes:
 *        - **0 matches** → throws an error.
 *        - **1 match**  → returns that model.
 *        - **>1 match** → presents a numbered list via the supplied `ui`
 *          instance and asks the user to pick one.
 *
 * The chosen model (its `id` and `provider`) are persisted in
 * `.cache/llimo.config.json` inside the current working directory,
 * making subsequent runs of the CLI default to the same selection.
 *
 * @param {Map<string, ModelInfo>} models
 * @param {string|undefined} modelPartial   Partial model identifier (e.g. "oss")
 * @param {string|undefined} providerPartial   Partial provider name (e.g. "cere")
 * @param {Ui} ui   UI helper for interactive prompts
 * @param {FileSystem} fs   Filesystem with working directory (used for config persistence)
 * @returns {Promise<ModelInfo>}
 */
export async function selectModel(models, modelPartial, providerPartial, ui, fs) {
	const lower = s => String(s ?? "").toLowerCase()

	/** @type {Array<ModelInfo>} */
	let candidates = Array.from(models.values()).filter(m => {
		const modelOk = !modelPartial || lower(m.id).includes(lower(modelPartial))
		const provOk = !providerPartial || lower(m.provider).includes(lower(providerPartial))
		return modelOk && provOk
	})

	if (candidates.length === 0) {
		throw new Error(
			`❌ No models match the criteria – model:${modelPartial ?? "*"} provider:${providerPartial ?? "*"}`
		)
	}

	if (candidates.length === 1) {
		const chosen = candidates[0]
		await persistChoice(chosen, fs)
		return chosen
	}

	// Multiple candidates – ask the user
	ui.console.info("\nMultiple models match your criteria:")
	candidates.forEach((m, i) => {
		ui.console.info(`  ${i + 1}) ${m.id} (provider: ${m.provider})`)
	})

	const answer = await ui.askYesNo("Select a model by number (or type a full id): ")
	const trimmed = answer.trim()

	// Direct id entry?
	const direct = candidates.find(m => m.id === trimmed)
	if (direct) {
		await persistChoice(direct, fs)
		return direct
	}

	const idx = parseInt(trimmed, 10) - 1
	if (!Number.isNaN(idx) && idx >= 0 && idx < candidates.length) {
		const chosen = candidates[idx]
		await persistChoice(chosen, fs)
		return chosen
	}

	throw new Error(`❌ Invalid selection "${answer}"`)
}

/**
 * Persist the chosen model/provider pair for the current project.
 *
 * @param {ModelInfo} model
 * @param {FileSystem} fs
 */
async function persistChoice(model, fs) {
	const config = await fs.load(".cache/llimo.json") ?? {}
	config.model = model.id
	config.provider = model.provider
	await fs.save(".cache/llimo.json", config)
}
