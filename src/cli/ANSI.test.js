import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import process from "node:process"

import * as ANSI from "./ANSI.js"

describe("ANSI", () => {
	const originalIsTTY = process.stdout.isTTY

	afterEach(() => {
		// Restore original TTY state using the accessor defined in ANSI.js
		process.stdout.isTTY = originalIsTTY
	})

	it("should provide empty strings when not TTY", () => {
		// Use the accessor to trigger updateAnsiExports()
		process.stdout.isTTY = false

		assert.strictEqual(ANSI.RESET, "")
		assert.strictEqual(ANSI.BOLD, "")
		assert.strictEqual(ANSI.RED, "")
		assert.strictEqual(ANSI.BG_RED, "")
	})

	it("should provide ANSI codes when TTY", () => {
		// Use the accessor to trigger updateAnsiExports()
		process.stdout.isTTY = true

		assert.strictEqual(ANSI.RESET, "\x1b[0m")
		assert.strictEqual(ANSI.BOLD, "\x1b[1m")
		assert.strictEqual(ANSI.RED, "\x1b[31m")
		assert.strictEqual(ANSI.BG_RED, "\x1b[41m")
	})

	it("should export COLORS object with foreground colors", () => {
		assert.strictEqual(ANSI.COLORS.BLACK, ANSI.BLACK)
		assert.strictEqual(ANSI.COLORS.RED, ANSI.RED)
		assert.strictEqual(Object.keys(ANSI.COLORS).length, 16)
	})

	it("should export BG_COLORS object with background colors", () => {
		assert.strictEqual(ANSI.BG_COLORS.BLACK, ANSI.BG_BLACK)
		assert.strictEqual(ANSI.BG_COLORS.RED, ANSI.BG_RED)
		assert.strictEqual(Object.keys(ANSI.BG_COLORS).length, 16)
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

	it("should strip ANSI special characters", () => {
		// Use the accessor to trigger updateAnsiExports()
		process.stdout.isTTY = true
		const str = ANSI.RED + "RED"
		assert.ok(str !== "RED")
		assert.equal(ANSI.stripANSI(str), "RED")
	})
})
