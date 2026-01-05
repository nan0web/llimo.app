import { UiOutput } from "../UiOutput.js"
import { RESET, GREEN, YELLOW } from "../ANSI.js"

/**
 * Simple progress indicator component.
 */
export class Progress extends UiOutput {
	/** @type {number} */
	value = 0
	/** @type {string} */
	text = ""
	/** @type {string} */
	prefix = ""
	/** @type {string[]} */
	rows = []
	/** @param {Partial<Progress>} [input={}] */
	constructor(input = {}) {
		super()
		const {
			value = this.value,
			text = this.text,
			prefix = this.prefix,
			rows = this.rows,
		} = input
		this.value = Number(value)
		this.text = String(text)
		this.prefix = String(prefix)
		this.rows = rows.map(r => String(r)).join("\n").split("\n")
	}

	/**
	 * @param {string} row
	 */
	add(row) {
		String(row).split("\n").map(r => this.rows.push(r))
	}

	toString(options = {}) {
		const {
			fill = "█",
			space = "░",
		} = options
		const percent = Math.round(this.value)
		const bar = GREEN + fill.repeat(percent / 5) + YELLOW + space.repeat((100 - percent) / 5) + RESET
		return `${this.prefix}${bar} ${this.text}`
	}

	/** @param {import("../Ui.js").Ui} ui */
	renderIn(ui) {
		ui.overwriteLine(this.toString())
	}
}
