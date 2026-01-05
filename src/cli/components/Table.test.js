import { describe, it } from "node:test"
import assert from "node:assert"
import { Table } from "./Table.js"
import { Ui, UiConsole } from "../Ui.js"

class TestUi extends Ui {
	calls = []
	constructor(options = {}) {
		super(options)
		this.console = new UiConsole()
		this.console.table = (rows = [], options = {}) => {
			this.calls.push([rows, options])
		}
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
			[rows, new Table.Options()]
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
			[rows, new Table.Options({})]
		])
	})
})
