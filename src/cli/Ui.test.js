import { describe, it, beforeEach } from "node:test"
import assert from "node:assert/strict"

import { Ui, UiConsole } from "./Ui.js"
import { ITALIC, RESET } from "./ANSI.js"
import { Console } from "node:console"

describe("UiConsole", () => {
	let mockConsole
	let consoleInstance

	beforeEach(() => {
		mockConsole = new Console(process.stdout, process.stderr)
		mockConsole.debug = () => { }
		mockConsole.info = () => { }
		mockConsole.log = () => { }
		mockConsole.warn = () => { }
		mockConsole.error = () => { }
		consoleInstance = new UiConsole({ console: mockConsole, debugMode: false })
	})

	it("does not output debug when debugMode is false", () => {
		let called = false
		mockConsole.debug = () => { called = true }
		consoleInstance.debug("test")
		assert.equal(called, false, "debug should not be called")
	})

	it("outputs debug when debugMode is true", () => {
		let calledMsg = null
		mockConsole.debug = (msg) => { calledMsg = msg }
		consoleInstance.debugMode = true
		consoleInstance.debug("hello", "world")
		assert.equal(calledMsg, "hello world")
	})

	it("success method forwards message via console.info", () => {
		/** @type {string} */
		let logged = ""
		mockConsole.info = (msg) => { logged = msg }
		consoleInstance.success("done")
		// Ensure the message contains the original text; colour codes may be stripped in some environments
		assert.ok(logged.includes("done"), "logged message should contain the provided text")
	})

	it("should properly print table", () => {
		const rows = [
			[`+ 33`, "message(s)", `(${ITALIC}111,222 byte(s)${RESET})`],
			[1, "system message(s)", `(${ITALIC}222 byte(s)${RESET})`],
			[15, "user message(s)", `(${ITALIC}100,000 byte(s)${RESET})`],
			[15, "assistant message(s)", `(${ITALIC}8,000 byte(s)${RESET})`],
			[3, "tool message(s)", `(${ITALIC}3,000 byte(s)${RESET})`],
		]
		const console = new UiConsole()
		const result = console.table(rows, { aligns: ["right", "left", "right"] })
		assert.deepStrictEqual(result, [
			'+ 33 | message(s)           | (111,222 byte(s))',
			'   1 | system message(s)    |     (222 byte(s))',
			'  15 | user message(s)      | (100,000 byte(s))',
			'  15 | assistant message(s) |   (8,000 byte(s))',
			'   3 | tool message(s)      |   (3,000 byte(s))',
		])
	})
})

describe("Ui", () => {
	it("isDebug reflects internal state", () => {
		const ui = new Ui()
		assert.equal(ui.isDebug, false)
		ui.setup(true)
		assert.equal(ui.isDebug, true)
	})

	it("askYesNo returns \"yes\" for affirmative answers", async () => {
		const ui = new Ui()
		// Stub the ask method to return various affirmative inputs
		ui.ask = async () => "Y"
		const result = await ui.askYesNo("Proceed?")
		assert.equal(result, "yes")
	})

	it("askYesNo returns \"no\" for negative answers", async () => {
		const ui = new Ui()
		ui.ask = async () => "n"
		const result = await ui.askYesNo("Proceed?")
		assert.equal(result, "no")
	})

	it("askYesNo returns raw answer when not recognisable", async () => {
		const ui = new Ui()
		const raw = "maybe"
		ui.ask = async () => raw
		const result = await ui.askYesNo("Proceed?")
		assert.equal(result, raw)
	})
})


describe("UiFormats.money formatting", () => {
	it("formats zero correctly", () => {
		const ui = new Ui()
		const res = ui.formats.money(0)
		assert.strictEqual(res, "$0.0000")
	})

	it("formats large numbers with thousands separators", () => {
		const ui = new Ui()
		const res = ui.formats.money(1234567.89)
		assert.strictEqual(res, "$1,234,567.8900")
	})

	it("formats with custom digits", () => {
		const ui = new Ui()
		const res = ui.formats.money(3.14159, 4)
		assert.strictEqual(res, "$3.1416")
	})

	it("formats negative numbers", () => {
		const ui = new Ui()
		const res = ui.formats.money(-12.3)
		assert.strictEqual(res, "-$12.3000")
	})
})

describe("Ui.bar", () => {
	/** @type {Array<[[number, number, string | undefined, string | undefined], string]>} */
	const examples = [
		[[0, 10, undefined, undefined], "          "],
		[[0.1, 10, undefined, undefined], "=         "],
		[[0.4, 10, undefined, undefined], "====      "],
		[[0.4, 10, "+", "-"], "++++------"],
		[[0.5, 10, undefined, undefined], "=====     "],
		[[1, 10, undefined, undefined], "=========="],
	]
	examples.forEach(([args, exp]) => {
		it(`should render bar correctly ${JSON.stringify(args)}`, () => {
			const ui = new Ui()
			const result = ui.bar.apply(ui, args)
			assert.equal(result, exp)
		})
	})
})

