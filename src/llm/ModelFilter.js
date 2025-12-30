/**
 * Reusable model filtering logic.
 * Encapsulates filter logic used across autocomplete and selectModel.
 */

import ModelInfo from './ModelInfo.js'

/**
 * Filter models based on fuzzy search or field filters.
 * @param {ModelInfo[]} models - Array of models to filter
 * @param {string} search - Search term or field filter
 * @returns {ModelInfo[]} - Filtered models
 */
export function filterModels(models, search) {
	if (!search || search.startsWith("/")) return models

	const lower = s => String(s ?? "").toLowerCase()

	if (search.startsWith("@")) {
		const filter = search.slice(1)
		const parsed = parseFieldFilter(filter)
		if (!parsed) return []

		return models.filter(model => {
			try {
				const field = parsed.field
				const value = model[field]
				const op = parsed.op
				const target = String(value ?? "").toLowerCase()

				if (op === "=" || !op) {
					return target === lower(parsed.value)
				} else if ("~" === op) {
					return target.includes(lower(parsed.value))
				}

				const num = Number(target)
				let numericVal = Number(parsed.value)
				if (parsed.value.endsWith("K")) {
					numericVal *= 1000
				} else if (parsed.value.endsWith("M")) {
					numericVal *= 1_000_000
				}

				if (isNaN(num)) return false
				return op === "<" ? num < numericVal : num > numericVal
			} catch {
				return false
			}
		})
	}

	const lowerSearch = search.toLowerCase()
	return models.filter(model => {
		// Match if either the model id **or** the provider contains the search term (partial, case-insensitive).
		return lower(model.id).includes(lowerSearch) ||
			lower(model.provider).includes(lowerSearch)
	})
}

/**
 * Parse field filter like @provider=novita or @context>32K
 * @param {string} filterStr e.g. "provider=novi" or "context>32K"
 * @returns {{field: string, op: string, value: string}} – returns empty strings when no explicit operator is present.
 */
function parseFieldFilter(filterStr) {
	const match = filterStr.match(/^([^=<>]+)([~><=]{1})(.+)$/i)
	if (match) {
		return { field: match[1].trim(), op: match[2], value: match[3].trim() }
	}
	return { field: "", op: "", value: filterStr.trim() }
}

export default { filterModels }

