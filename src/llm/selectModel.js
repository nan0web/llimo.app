import { Ui } from "../cli/Ui.js"
import { ModelInfo } from "./ModelInfo.js"
import { model2row } from "../cli/autocomplete.js"
import { DIM, RESET } from "../cli/ANSI.js"

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
 * @param {string} modelPartial   Partial model identifier (e.g. "oss")
 * @param {string|undefined} providerPartial   Partial provider name (e.g. "cere")
 * @param {Ui} ui   UI helper for interactive prompts
 * @param {(chosen: ModelInfo) => void} [onSelect]   Current chat instance
 * @returns {Promise<ModelInfo | undefined>}
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
		Array.from(models.values()).forEach(m => {
			const modelOk = !model || lower(m.id).includes(lower(model))
			const provOk = !provider || lower(m.provider).includes(lower(provider))
			if (modelOk && provOk) result.push(m)
		})
		return result
	}

	const exact = models.get(`${modelPartial}@${providerPartial}`)
	if (exact) {
		onSelect(exact)
		return exact
	}

	/** @type {Array<ModelInfo>} */
	let candidates = findCandidates(modelPartial, providerPartial)

	if (candidates.length === 0) {
		ui.console.warn(`! No models match the criteria – model:${modelPartial ?? "*"} provider:${providerPartial ?? "*"}`)
		ui.console.warn(`  Looking for the same model pattern in all providers`)
		candidates = findCandidates(modelPartial)
	}

	if (candidates.length === 0) {
		return
	}

	if (candidates.length === 1) {
		const chosen = candidates[0]
		onSelect(chosen)
		return chosen
	}
	candidates.sort((a, b) => a.id.localeCompare(b.id))

	// Multiple candidates – ask the user
	ui.console.info(`\nMultiple models match your criteria [model = ${modelPartial}, provider = ${providerPartial}]:`)

	const rows = [
		["No", "Model id", "Provider", "Context", "Input", "Output"],
		["---", "---", "---", "---", "---", "---"],
	]
	if (!candidates.length) {
		return
	}
	candidates.forEach((m, i) => {
		const row = model2row(m)
		rows.push([
			String(i + 1),
			row.id,
			row.provider,
			ui.formats.weight("T", row.context),
			row.inputPrice < 0 ? `${DIM}empty${RESET}` : ui.formats.pricing(row.inputPrice, 2),
			row.outputPrice < 0 ? `${DIM}empty${RESET}` : ui.formats.pricing(row.outputPrice, 2),
		])
	})
	ui.console.table(rows, { aligns: ["right", "left", "left", "right", "right", "right"] })

	const answer = await ui.ask("Select a model by number (or type its full id): ")
	const trimmed = answer.trim()

	// Direct id entry?
	const direct = candidates.find(m => m.id === trimmed)
	if (direct) {
		onSelect(direct)
		return direct
	}

	const idx = parseInt(trimmed, 10) - 1
	if (!Number.isNaN(idx) && idx >= 0 && idx < candidates.length) {
		const chosen = candidates[idx]
		onSelect(chosen)
		return chosen
	}

	throw new Error(`❌ Invalid selection "${answer}"`)
}
