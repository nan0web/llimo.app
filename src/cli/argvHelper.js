/**
 * Cast a value to a specific primitive type.
 *
 * @param {any} value
 * @param {string} to
 * @returns {any}
 */
function cast(value, to) {
	if ("string" === to) return String(value)
	if ("number" === to) return Number(value)
	return value
}

/**
 * Simple argument parser – returns an **instance** of the provided Model.
 *
 * @template T extends object
 * @param {string[]} argv - Raw arguments (process.argv.slice(2))
 * @param {new (...args:any)=>T} Model - Class whose static properties describe options.
 * @returns {T}
 */
export function parseArgv(argv, Model) {
	// build lookup: long name → prop, alias → prop
	const nameMap = {}
	for (const [prop, cfg] of Object.entries(Model)) {
		nameMap[prop] = prop
		if (cfg.alias) nameMap[cfg.alias] = prop
	}

	/** @type {T} */
	const result = new Model()

	let i = 0
	while (i < argv.length) {
		const raw = argv[i]
		const next = String(argv[i + 1] ?? "")
		let optName = ""

		if (raw.startsWith("-")) {
			const stripped = raw.slice(raw.startsWith("--") ? 2 : 1)
			const candidate = stripped.includes("=") ? stripped.split("=")[0] : stripped
			if (candidate in nameMap) optName = nameMap[candidate]
		}

		if (optName) {
			const defaultVal = Model[optName]?.default
			const type = Model[optName]?.type ?? typeof defaultVal
			let value

			if (raw.includes("=")) {
				const [, ...parts] = raw.split("=")
				value = parts.join("=")
			} else if ("boolean" === type) {
				value = true
			} else if (next) {
				++i
				value = cast(next, type)
			} else {
				throw new Error(`Value for the option "${optName}" not provided`)
			}
			result[optName] = value
		} else {
			// Positional argument – push into result.argv if it exists.
			// Using a runtime guard; @ts-ignore silences TS complaining about missing property.
			// @ts-ignore
			if (result.argv && Array.isArray(result.argv)) {
				// @ts-ignore
				result.argv.push(raw)
			}
		}
		++i
	}
	return result
}

/**
 * @param {typeof Object} Model
 * @returns {string}
 */
export function renderHelp(Model) {
	const result = []
	for (const [name, meta] of Object.entries(Model)) {
		result.push(`--${name} ${meta?.help ?? ""}`)
	}
	return result.join("\n")
}
