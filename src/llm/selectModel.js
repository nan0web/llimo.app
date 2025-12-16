import Ui from "../cli/Ui.js"
import ModelInfo from "./ModelInfo.js"
import FileSystem from "../utils/FileSystem.js"
import Chat from "./Chat.js"

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
 * @param {Map<string, ModelInfo[]>} models
 * @param {string} modelPartial   Partial model identifier (e.g. "oss")
 * @param {string|undefined} providerPartial   Partial provider name (e.g. "cere")
 * @param {Ui} ui   UI helper for interactive prompts
 * @param {(chosen: ModelInfo) => void} [onSelect]   Current chat instance
 * @returns {Promise<ModelInfo>}
 */
export async function selectModel(models, modelPartial, providerPartial, ui, onSelect = () => { }) {
	const lower = s => String(s ?? "").toLowerCase()

	/**
	 * @param {string} model
	 * @param {string | undefined} [provider]
	 * @returns {ModelInfo[]}
	 */
	const findCandidates = (model, provider = "") => {
		const result = []
		Array.from(models.values()).forEach(arr => {
			arr.forEach(m => {
				const modelOk = !model || lower(m.id).includes(lower(model))
				const provOk = !provider || lower(m.provider).includes(lower(provider))
				if (modelOk && provOk) result.push(m)
			})
		})
		return result
	}

	/** @type {Array<ModelInfo>} */
	let candidates = findCandidates(modelPartial, providerPartial)

	if (candidates.length === 0) {
		ui.console.warn(`❌ No models match the criteria – model:${modelPartial ?? "*"} provider:${providerPartial ?? "*"}`)
		ui.console.warn(`  Looking for the same model pattern in all providers`)
		candidates = findCandidates(modelPartial)
	}

	if (candidates.length === 1) {
		const chosen = candidates[0]
		await onSelect(chosen)
		return chosen
	}

	// Multiple candidates – ask the user
	ui.console.info(`\nMultiple models match your criteria [model = ${modelPartial}, provider = ${providerPartial}]:`)
	candidates.forEach((m, i) => {
		ui.console.info(`  ${i + 1}) ${m.id} (provider: ${m.provider})`)
	})

	const answer = await ui.ask("Select a model by number (or type its full id): ")
	const trimmed = answer.trim()

	// Direct id entry?
	const direct = candidates.find(m => m.id === trimmed)
	if (direct) {
		await onSelect(direct)
		return direct
	}

	const idx = parseInt(trimmed, 10) - 1
	if (!Number.isNaN(idx) && idx >= 0 && idx < candidates.length) {
		const chosen = candidates[idx]
		await onSelect(chosen)
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
