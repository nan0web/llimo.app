/** @typedef {"success" | "info" | "warn" | "error" | "debug"} AlertVariant */

import { UiOutput } from "../UiOutput.js"

/**
 * Simple wrapper for displaying a line in the console.
 * The UI instance is injected from the caller (llimo‑chat).
 */
export class Alert extends UiOutput {
	/** @type {string} */
	text = ""
	/** @type {AlertVariant} */
	variant = "info"
	/**
	 * @param {Partial<Alert>} input
	 */
	constructor(input = {}) {
		super()
		if ("string" === typeof input) {
			input = { text: input }
		}
		const {
			text = this.text,
			variant = this.variant,
		} = input
		this.text = String(text ?? "")
		this.variant = "success" === variant ? "success"
			: "debug" === variant ? "debug"
				: "error" === variant ? "error"
					: "warn" === variant ? "warn"
						: "info"
	}
	toString() {
		return this.text
	}
	/** @param {import("../Ui.js").Ui} ui */
	renderIn(ui) {
		if ("function" === typeof ui.console[this.variant]) {
			ui.console[this.variant](String(this))
		} else {
			ui.console.info(String(this))
		}
	}
	static error(text = "") {
		return new Alert({ variant: "error", text })
	}
	static info(text = "") {
		return new Alert({ variant: "info", text })
	}
}
