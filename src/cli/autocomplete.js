import readline from "node:readline"
import { RESET, YELLOW } from "./ANSI.js"
import Ui from "./Ui.js"

/**
 * Autocomplete for models – shared interactive search and filtering logic.
 * Can be used for other datasets too, but currently specialized for models.
 *
 * Export functions for easy testing and reuse.
 *
 * @module cli/autocomplete
 */

/**
 * @typedef {Object} ModelRow
 * @property {string} id
 * @property {number} context
 * @property {string} provider
 * @property {string} modality
 * @property {number} inputPrice
 * @property {number} outputPrice
 * @property {boolean} tools
 * @property {boolean} json
 */

/**
 * Flatten models map into ModelRow[] for filtering/sorting.
 * @param {Map<string, import("../llm/ModelInfo").default[]>} modelMap
 * @returns {ModelRow[]}
 */
export function modelRows(modelMap) {
	const flat = []
	for (const [id, infos] of modelMap.entries()) {
		for (const info of infos) {
			const context = Number(
				info.context_length ??
				info.architecture?.context_length ??
				info.top_provider?.context_length ??
				0
			)

			const pricing = info.pricing
			const inputPrice = pricing?.prompt ?? -1
			const outputPrice = pricing?.completion ?? -1
			const modality = info.architecture?.input_modalities?.[0]
				|| info.architecture?.modality
				|| "text"

			const tools = !!(info.supports_tools ?? info.supportsTools ?? false)
			const jsonMode = !!(info.supports_structured_output ?? info.supportsStructuredOutput ?? false)

			flat.push({
				id,
				context,
				provider: info.provider,
				modality,
				inputPrice,
				outputPrice,
				tools,
				json: jsonMode,
			})
		}
	}
	return flat.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Format context length (e.g. 131072 -> 131K)
 * @param {number} ctx
 * @returns {string}
 */
export function formatContext(ctx) {
	if (ctx >= 1e6) return (ctx / 1e6).toFixed(0) + "M"
	if (ctx >= 1e3) return (ctx / 1e3).toFixed(0) + "K"
	return `${ctx}T`
}

/**
 * Highlight search term in a cell
 * @param {string} cell
 * @param {string} search
 * @returns {string}
 */
export function highlightCell(cell, search) {
	if (!search || search.startsWith("/")) return cell
	const idx = cell.toLowerCase().indexOf(search.toLowerCase())
	if (idx === -1) return cell
	return `${cell.substring(0, idx)}${YELLOW}${cell.substring(idx, idx + search.length)}${RESET}${cell.substring(idx + search.length)}`
}

/**
 * Parse field filter like @provider=novi or @context>32K
 * @param {string} filterStr e.g. "provider=novi" or "context>32K"
 * @returns {{field: string, op: string, value: string}} – returns empty strings when no explicit operator is present.
 */
export function parseFieldFilter(filterStr) {
	const eqMatch = filterStr.match(/^([^=<>]+)=(.*)$/)
	if (eqMatch) {
		return { field: eqMatch[1].trim(), op: "=", value: eqMatch[2].trim() }
	}
	const opMatch = filterStr.match(/^([^<>]+)([<>])(.*)$/)
	if (opMatch) {
		return { field: opMatch[1].trim(), op: opMatch[2], value: opMatch[3].trim() }
	}
	return { field: "", op: "", value: filterStr.trim() }
}

/**
 * Filter models based on search string
 * @param {ModelRow[]} models
 * @param {string} search
 * @returns {ModelRow[]}
 */
export function filterModels(models, search) {
	if (!search || search.startsWith("/")) return models

	if (search.startsWith("@")) {
		const filter = search.slice(1)
		const parsed = parseFieldFilter(filter)
		if (!parsed) return []

		return models.filter(row => {
			try {
				const value = row[parsed.field]
				if (parsed.op === "=" || !parsed.op) {
					if (parsed.field === "id" && parsed.op === "=") {
						return String(value).toLowerCase() === parsed.value.toLowerCase()
					}
					return String(value).toLowerCase().includes(parsed.value.toLowerCase())
				}

				const target = Number(value)
				let numericVal = Number(parsed.value)
				if (parsed.value.endsWith("K")) {
					numericVal = Number(parsed.value.slice(0, -1)) * 1_000
				} else if (parsed.value.endsWith("M")) {
					numericVal = Number(parsed.value.slice(0, -1)) * 1_000_000
				}

				if (isNaN(target) || isNaN(numericVal)) return false
				return parsed.op === "<" ? target < numericVal : target > numericVal
			} catch {
				return false
			}
		})
	}

	const lowerSearch = search.toLowerCase()
	return models.filter(row => {
		if (row.id.toLowerCase() === lowerSearch) return true
		return row.provider.toLowerCase().includes(lowerSearch)
	})
}

/**
 * Render table with dynamic widths and highlighting
 * @param {ModelRow[]} filtered
 * @param {string} search
 * @param {number} startIndex
 * @param {number} maxY
 * @param {Ui} ui
 * @returns {void}
 */
export function renderTable(filtered, search, startIndex, maxY, ui) {
	const headers = ["ID", "Context", "Provider", "Modality", "Price in", "Price out", "Tools", "JSON."]
	const dataRows = []
	const endIndex = Math.min(startIndex + maxY - 4, filtered.length)

	for (let i = startIndex; i < endIndex; i++) {
		const row = filtered[i]
		const { id, context: ctx, provider: prov, modality: mod, inputPrice: inP, outputPrice: outP, tools, json } = row
		dataRows.push([
			highlightCell(id, search),
			formatContext(ctx),
			highlightCell(prov, search),
			mod,
			inP < 0 ? "-" : `$${inP.toFixed(6)}`,
			outP < 0 ? "-" : `$${outP.toFixed(6)}`,
			tools ? "+" : "-",
			json ? "+" : "-"
		])
	}

	const allRows = [headers, ...dataRows]
	if (startIndex > 0) allRows.unshift(["↑ Scroll up to see more..."].concat(new Array(7).fill("")))
	if (endIndex < filtered.length) allRows.push(["↓ Scroll down to see more..."].concat(new Array(7).fill("")))

	if (filtered.length > 0) {
		const showing = `Showing ${startIndex + 1}-${endIndex} of ${filtered.length} models`
		allRows.push([showing].concat(new Array(7).fill("")))
	}

	ui.console.table(allRows, {
		divider: " │ ",
		aligns: ["left", "right", "left", "left", "right", "right", "center", "center"]
	})
}

/**
 * Clear specific number of lines and move cursor to start
 * @param {number} lines
 */
export function clearLines(lines) {
	process.stdout.write(`\r\x1b[K${"\x1b[" + lines + "A"}\r\x1b[K`)
}

/**
 * Interactive search with live keypress, scrolling, and command suggestions
 * @param {Map<string, import("../llm/ModelInfo").default[]>} modelMap
 * @param {Ui} ui
 * @returns {Promise<void>}
 */
export async function interactive(modelMap, ui) {
	const allModels = modelRows(modelMap)
	let search = ""
	let filtered = allModels
	let startIndex = 0
	const maxY = process.env.NODE_TEST ? 3 : 20
	let suggestionLines = 0

	if (process.stdin.isTTY) {
		readline.emitKeypressEvents(process.stdin)
		process.stdin.setRawMode(true)
	}

	renderTable(filtered, search, startIndex, maxY, ui)
	process.stdout.write("\nType model name or / to search, @ to filter fields (e.g. @provider=novita), /help, /quit:\nFilter: ")

	return new Promise((resolve) => {
		const keypressHandler = (str, key) => {
			if (key.ctrl && key.name === 'c') {
				clearLines(3 + suggestionLines)
				process.stdin.setRawMode(false)
				process.stdin.pause()
				resolve()
				return
			}

			const prevIsCommand = search.startsWith("/")
			const prevSuggestionLines = suggestionLines

			if (key.name === 'backspace' || key.name === 'delete') {
				search = search.slice(0, -1)
			} else if (key.name === 'up' && !search.startsWith("/")) {
				startIndex = Math.max(0, startIndex - 1)
			} else if (key.name === 'down' && !search.startsWith("/")) {
				const pageSize = maxY - 4
				startIndex = Math.min(filtered.length - pageSize, startIndex + pageSize)
			} else if (key.name === 'return') {
				const trimmed = search.trim()
				if (trimmed === "/quit") {
					clearLines(3 + suggestionLines)
					process.stdin.setRawMode(false)
					process.stdin.pause()
					resolve()
					return
				} else if (trimmed === "/help") {
					ui.console.info(`${YELLOW}Help: Type to search/filter models.\nCommands: /help, /quit\nFilter by field: @id=qwen, @provider=novita, @context>32K, etc.${RESET}`)
					search = ""
					filtered = allModels
					startIndex = 0
				}
			} else if (key.sequence && key.sequence.length === 1 && key.name !== 'return') {
				search += str
			}

			const isCommand = search.startsWith("/")
			let needsReRender = false
			let needsClear = false

			if (!isCommand) {
				const newFiltered = filterModels(allModels, search)
				if (newFiltered !== filtered || key.name === 'up' || key.name === 'down') {
					filtered = newFiltered
					if (key.name === 'up' || key.name === 'down') {
						const pageSize = maxY - 4
						if (startIndex >= filtered.length) {
							startIndex = Math.max(0, filtered.length - pageSize)
						}
					} else {
						startIndex = 0
					}
					needsReRender = true
				}
			} else if (prevIsCommand !== isCommand || search === "") {
				filtered = allModels
				startIndex = 0
				needsReRender = true
				needsClear = true
			}

			let newSuggestions = ""
			let newSuggestionLines = 0
			if (isCommand && search.length >= 1 && !search.includes(" ")) {
				const suggestions = ["/help", "/quit"].filter(cmd => cmd.startsWith(search))
				if (suggestions.length) {
					newSuggestions = `Suggestions: ${suggestions.join(", ")}`
					newSuggestionLines = 1
				}
			}
			if (newSuggestionLines !== prevSuggestionLines && prevSuggestionLines > 0) {
				clearLines(prevSuggestionLines)
				needsClear = true
			}

			if (needsReRender || needsClear) {
				console.clear()
				renderTable(filtered, search, startIndex, maxY, ui)
				process.stdout.write("\nType model name or / to search, @ to filter fields (e.g. @provider=novita), /help, /quit:\nFilter: ")
			}

			process.stdout.write(`\r\x1b[KFilter: ${search}`)
			suggestionLines = newSuggestionLines
			if (suggestionLines > 0) {
				process.stdout.write(`\n\x1b[K${newSuggestions}`)
			}
		}

		process.stdin.on('keypress', keypressHandler)
	})
}

/**
 * Output all models in pipe format for non-interactive use
 * @param {ModelRow[]} allModels
 */
export function pipeOutput(allModels) {
	for (const row of allModels) {
		const inp = row.inputPrice < 0 ? '-' : `$${row.inputPrice.toFixed(6)}`
		const outp = row.outputPrice < 0 ? '-' : `$${row.outputPrice.toFixed(6)}`
		console.info(`${row.id} │ ${formatContext(row.context)} │ ${row.provider} │ ${row.modality} │ ${inp} │ ${outp} │ ${row.tools ? '+' : '-'} │ ${row.json ? '+' : '-'} │`)
	}
}

export const autocompleteModels = {
	modelRows,
	filterModels,
	formatContext,
	highlightCell,
	parseFieldFilter,
	renderTable,
	clearLines,
	interactive,
	pipeOutput,
}
