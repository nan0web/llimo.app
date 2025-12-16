import UiOutput from "../UiOutput.js"

export class Table extends UiOutput {
	/** @type {any[][]} */
	rows = []
	/** @type {{divider?: string | number, aligns?: string[]}} */
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
		this.options = options
	}
	toString() {
		const divider = "number" === typeof this.options.divider
			? " ".repeat(this.options.divider) : String(this.options.divider)
		return this.rows.map(a => a.join(divider)).join("\n")
	}
	/** @param {import("../Ui.js").Ui} ui */
	renderIn(ui) {
		ui.console.table(this.rows, this.options)
	}
}

export default Table
