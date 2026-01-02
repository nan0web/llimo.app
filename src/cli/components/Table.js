import UiOutput from "../UiOutput.js"

/**
 * @typedef {"left" | "center" | "right"} TableAlign
 */

export class TableOptions {
	/** @type {string} */
	divider
	static divider = {
		help: "Column divider",
		default: "",
	}
	/** @type {TableAlign[]} */
	aligns
	static aligns = {
		help: "Column aligns, when empty left is used for every column",
		default: [],
	}
	/**
	 * @param {Partial<TableOptions> & { divider?: string | number }} input
	 */
	constructor(input = {}) {
		const {
			divider = TableOptions.divider.default,
			aligns = TableOptions.aligns.default,
		} = input
		this.divider = "number" === typeof divider ? " ".repeat(divider) : String(divider)
		this.aligns = aligns.map(
			value => "center" === value ? "center" : "right" === value ? "right" : "left"
		)
	}
}

export class Table extends UiOutput {
	/** @type {any[][] | object[]} */
	rows = []
	/** @type {Partial<TableOptions>} */
	options = {}
	/**
	 * @param {Partial<Table>} [input={}]
	 */
	constructor(input = {}) {
		super()
		const {
			rows = this.rows,
			options = this.options,
		} = input
		this.rows = rows
		this.options = new TableOptions(options)
	}
	toString() {
		const divider = "number" === typeof this.options.divider
			? " ".repeat(this.options.divider) : String(this.options.divider ?? "")
		return this.rows.map(a => a.join(divider)).join("\n")
	}
	/**
	 * @todo write jsdoc
	 * @param {any[][] | object[]} rows
	 * @returns {any[][]}
	 */
	static normalizeRows(rows) {
		if (rows.every(r => Array.isArray(r))) return rows
		const result = []
		const colSet = new Set()
		rows.forEach(obj => Object.keys(obj).forEach(k => colSet.add(k)))
		const cols = Array.from(colSet)
		result.push(cols)
		result.push(cols.map(() => "--"))
		rows.forEach(row => result.push(cols.map(c => String(row[c] ?? ""))))
		return result
	}
}

export default Table
