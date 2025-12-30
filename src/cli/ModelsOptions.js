import ModelInfo from "../llm/ModelInfo.js"

export class ModelsOptions {
	filter
	static filter = {
		help: [
			"Filter the models list",
			"",
			"Use attributes divided by space to filter:",
			"- id - model name by = or ~",
			"- context - context length by >, <, =",
			"- provider - provider name by = or ~",
			"- price - output price by >, <, =",
			"",
			"Examples:",
			'llimo models --filter="id~gpt price<2 context>100K"',
			'llimo models --filter="provider=cerebras"',
			'llimo models --filter="provider~cerebras"',
			"",
			"Filtering applies after parsing; output only matching models and exit.",
		].join("\n"),
		default: "",
	}
	help
	static help = {
		alias: "h",
		help: "Show help",
		default: false,
	}
	constructor(input = {}) {
		const {
			filter = ModelsOptions.filter.default,
			help = ModelsOptions.help.default,
		} = input
		this.filter = String(filter)
		this.help = Boolean(help)
	}
	/**
	 * @returns {Array<(model: ModelInfo) => boolean>}
	 */
	getFilters() {
		const regExp = /(id|provider|context|price)([~><=]{1})(.+)/i
		const available = new Map([
			["id", ["=", "~"]],
			["provider", ["=", "~"]],
			["context", ["=", ">", "<"]],
			["price", ["=", ">", "<"]],
		])
		/** @type {Array<(model: ModelInfo) => boolean>} */
		const filters = []

		for (const pair of this.filter.split(" ")) {
			if (!pair) continue
			const match = pair.match(regExp)
			if (!match) {
				throw new Error(`No valid filters parsed from "${this.filter}"`)
			}
			let [, rawName, op, rawValue] = match
			const name = rawName.trim().toLowerCase()
			const ops = available.get(name) ?? []
			if (!ops.includes(op)) {
				throw new Error(`No such operation ${op} for ${name}\nAvailable operations: ${ops.join(", ")}.`)
			}
			let value
			if (["price", "context"].includes(name)) {
				const valStr = rawValue.trim().toLowerCase()
				let numVal
				if (/^\d+[kK]$/.test(valStr)) {
					numVal = Math.round(Number(valStr.slice(0, -1)) * 1e3)
				} else if (/^\d+[mM]$/.test(valStr)) {
					numVal = Math.round(Number(valStr.slice(0, -1)) * 1e6)
				} else {
					numVal = Number(valStr)
				}
				if (isNaN(numVal)) {
					throw new Error(`Invalid number: "${rawValue}"`)
				}
				value = numVal
			} else {
				value = String(rawValue).toLowerCase()
			}
			if ("~" === op) {
				filters.push((model) => {
					const field = name === "context" ? "context_length" : name === "price" ? "pricing.completion" : name
					const v = name === "price" ? getPath(model, field.split(".")) : model[field]
					return String(v ?? "").toLowerCase().includes(String(value))
				})
			} else if ("=" === op) {
				if (name === "price") {
					filters.push((model) => {
						const completion = model.pricing?.completion ?? 0
						const rounded = parseInt(completion.toFixed(0), 10)
						return rounded === value
					})
				} else if (name === "context") {
					filters.push((model) => model.context_length === value)
				} else {
					filters.push((model) => model[name] === value)
				}
			} else if (">" === op) {
				filters.push((model) => {
					const num = name === "context" ? model.context_length : (name === "price" ? (model.pricing?.completion ?? 0) : 0)
					return num > Number(value)
				})
			} else if ("<" === op) {
				filters.push((model) => {
					const num = name === "context" ? model.context_length : (name === "price" ? (model.pricing?.completion ?? 0) : 0)
					return num < Number(value)
				})
			}
		}
		if (filters.length === 0 && this.filter.trim()) {
			throw new Error(`No valid filters parsed from "${this.filter}"`)
		}
		return filters
	}
}

function getPath(obj, path) {
	let current = obj
	for (const p of path) {
		current = current[p]
		if (current === undefined) return undefined
	}
	return current
}

export default ModelsOptions
