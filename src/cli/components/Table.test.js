import { describe, it } from "node:test"
import assert from "node:assert"
import Table, { TableOptions } from "./Table.js"
import Ui from "../Ui.js"

class TestUi extends Ui {
	calls = []
	constructor(options = {}) {
		super(options)
		this.console = {
			table: this.table.bind(this),
		}
	}
	table(rows = [], options = {}) {
		this.calls.push([rows, options])
	}
}

describe("UiTable", () => {
	it("should render string[][]", () => {
		const rows = [
			["No", "Title"],
			["--", "--"],
			["1", "First"],
			["2", "Second"],
		]
		const table = new Table({ rows })
		const ui = new TestUi()
		ui.render(table)
		assert.deepStrictEqual(ui.calls, [
			[rows, new TableOptions()]
		])
	})

	it("should render object[]", () => {
		const data = [
			{ No: 1, Title: "First" },
			{ No: 2, Title: "Second" },
		]
		const rows = [
			["No", "Title"],
			["--", "--"],
			["1", "First"],
			["2", "Second"],
		]
		const table = new Table({ rows: data })
		const ui = new TestUi()
		ui.render(table)
		assert.deepStrictEqual(ui.calls, [
			[rows, new TableOptions({})]
		])
	})
})
