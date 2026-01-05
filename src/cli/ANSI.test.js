import { describe, it } from "node:test"
import assert from "node:assert/strict"

import * as ANSI from "./ANSI.js"

describe("ANSI", () => {
	it("should provide empty strings when not TTY", () => {
		assert.strictEqual(ANSI.RESET, "")
		assert.strictEqual(ANSI.BOLD, "")
		assert.strictEqual(ANSI.RED, "")
	})

	it("should export COLORS object with foreground colors", () => {
		assert.strictEqual(ANSI.COLORS.BLACK, ANSI.BLACK)
		assert.strictEqual(ANSI.COLORS.RED, ANSI.RED)
		assert.strictEqual(Object.keys(ANSI.COLORS).length, 7)
	})

	it("should provide CLEAR_LINE constant", () => {
		assert.strictEqual(ANSI.CLEAR_LINE, "\x1b[2K")
	})

	it("should provide OVERWRITE_LINE constant", () => {
		assert.strictEqual(ANSI.OVERWRITE_LINE, "\r\x1b[K")
	})

	it("should overwrite line with string", () => {
		const result = ANSI.overwriteLine("test")
		assert.strictEqual(result, "\r\x1b[Ktest")
	})

	it("should overwrite line with empty string", () => {
		const result = ANSI.overwriteLine()
		assert.strictEqual(result, "\r\x1b[K")
	})

	it("should move cursor up by default 1 row", () => {
		const result = ANSI.cursorUp()
		assert.strictEqual(result, "\x1b[1A")
	})

	it("should move cursor up by 3 rows", () => {
		const result = ANSI.cursorUp(3)
		assert.strictEqual(result, "\x1b[3A")
	})
})
