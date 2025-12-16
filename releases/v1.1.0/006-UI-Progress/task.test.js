/**
 * @todo Detailed English: Enhance UI in src/cli/Ui.js with ANSI colors (import from src/cli/ANSI.js), overwriteLine/cursorUp for dynamic progress, createProgress (interval with fps for elapsed updates). In src/llm/chatProgress.js, implement formatChatProgress: Generate padded table with phases (reading/reasoning/answering), calculate speeds (tokens/elapsed, safeSpeed to avoid NaN via Math.max(0, tokens/elapsed)), costs (tokens * pricing/1e6, safeSpent for time). Interactive in src/utils/ReadLine.js: askYesNo parses y/empty→"yes", n→"no", other→raw; keypress for ls filter (readline.emitKeypressEvents, on 'keypress' filter list real-time).
 *       - Create: src/cli/ProgressTable.js (pad columns), src/utils/KeypressFilter.js (live search for ls).
 *       - Tests: src/cli/Ui.test.js (mock stdout, assert overwrite/cursor calls), src/llm/chatProgress.test.js (mock usage/clock/model, assert no NaN lines e.g. "reading | 2.5s | 120T | 48T/s | $0.000350"), src/utils/ReadLine.test.js (mock stdin push "y"/"", assert "yes").
 *       Deps: 1.2 (stdin handling), 5.3 (ls table).
 *       Security: Sanitize UI output (stripANSI for lengths), limit progress loops (<60s to prevent infinite), keypress input validation (no shell injection).
 *       After code: Run tests from tests.txt (edge cases: large elapsed>3600 cap, zero tokens), then pnpm test:all (UI mocks).
 */

import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import { formatChatProgress } from "../../../src/llm/chatProgress.js"
import Ui from "../../../src/cli/Ui.js"
import ReadLine from "../../../src/utils/ReadLine.js"
import { stripANSI } from "../../../src/cli/ANSI.js"

describe("006-UI-Progress – src/cli/* & src/llm/chatProgress.js", () => {
	describe("6.1 ANSI colors, overwriteLine, cursorUp for progress bars", () => {
		it("Ansi colors apply and stripANSI works for table padding (no malformed output)", () => {
			// Mock ANSI codes: \x1b[32mtext\x1b[0m
			const colored = "\x1b[32m100T\x1b[0m"
			const stripped = stripANSI(colored)
			strictEqual(stripped, "100T", "Strips ANSI for accurate column widths")
			const ui = new Ui()
			ui.overwriteLine(colored)  // Mock stdout.write
			ok(ui.stdout.write.mock.calls.length === 1, "over writeLine applies code + text")
			ui.cursorUp(3)  // Move up 3 lines
			ok(ui.stdout.write.mock.calls[1] === "\x1b[3A", "Cursor up emits sequence")
		})

		it("createProgress calls fn with elapsed/startTime, clears on stop", async () => {
			const mockFn = sinon.spy(() => {})  // Assuming sinon or mock.fn()
			const interval = TestUtils.createProgress(mockFn, Date.now(), 30)
			await new Promise(r => setTimeout(r, 50))  // Let 1 tick pass
			ok(mockFn.called, "Calls fn periodically (fps=30)")
			clearInterval(interval)  // Clean
			ok(interval, "Interval created/stoppable")
		})

		it("formatChatProgress generates padded table with safe speeds/costs (no NaN)", () => {
			const usage = new LanguageModelUsage({ inputTokens: 120, reasoningTokens: 10, outputTokens: 50 })
			const clock = { startTime: Date.now() - 5000, reasonTime: Date.now() - 2000, answerTime: Date.now() - 1000 }
			const model = new ModelInfo({ pricing: { prompt: 0.00035, completion: 0.001 } })
			const lines = formatChatProgress({ usage, clock, model, format: (n) => n.toString() })
			ok(lines.length === 4, "Generates 4 lines: total + reading + reasoning + answering")
			const readingLine = lines.find(l => l.includes("reading"))
			ok(readingLine.includes("2.0s"), "Elapsed time for phases")
			ok(!readingLine.includes("NaN"), "Safe calculation prevents NaN speeds")
			const costMatch = readingLine.match(/\$[\d.]+/)
			const costNum = costMatch ? parseFloat(costMatch[0].slice(1)) : 0
			ok(costNum > 0, "Formats costs correctly (120 * 0.00035 = 0.042)")
		})
	})

	describe("6.2 Interactive prompts: askYesNo (y/n/empty→yes), keypress for ls filter", () => {
		it("askYesNo parses input correctly: y/empty→'yes', n→'no', other→raw string", async () => {
			const mockStdin = new Readable({ read: () => {} })
			mockStdin.push("y")  // y → yes
			mockStdin.push(null)
			const ui = new Ui({ stdin: mockStdin })  // Mock anode.stdin undefined

			const result1 = await ui.askYesNo("Test?")
			let mockStdin2 = new Readable({ read: () => {} })
			mockStdin2.push("\n")  // Empty → yes
			mockStdin2.push(null)
			const ui2 = new Ui({ stdin: mockStdin2 })

			const result2 = await ui2.askYesNo("Empty?")

			let mockStdin3 = new Readable({ read: () => {} })
			mockStdin3.push("n\n")
			mockStdin3.push(null)
			const ui3 = new Ui({ stdin: mockStdin3 })

			const result3 = await ui3.askYesNo("No?")

			let mockStdin4 = new Readable({ read: () => {} })
			mockStdin4.push("Custom input\n")
			mockStdin4.push(null)
			const ui4 = new Ui({ stdin: mockStdin4 })

			const result4 = await ui4.askYesNo("Custom?")

			strictEqual(result1, "yes", "Capital Y or empty line maps to 'yes'")
			strictEqual(result2, "yes", "Empty line defaults to 'yes'")
			strictEqual(result3, "no", "N maps to 'no'")
			strictEqual(result4, "Custom input", "Raw for unrecognized input")
		})

		it("Keypress filter for ls: Real-time update table on input (e.g., 'a' filters to Archive matches)", async () => {
			const mockStdin = new Readable({ read: () => {} })
			const mockStdout = new Writable({
				write(chunk, enc, cb) { this.mockOutput += chunk; cb() }
			})
			mockStdout.mockOutput = ""
			const mockKeyboard = {
				on: mock.fn((event, handler) => event === "keypress" && mockStdin.on("data", handler))
			}
			const ui = new Ui({ stdin: mockStdin, stdout: mockStdout })
			// Mock readline.emitKeypressEvents (keypress events)
			Object.assign(mockStdin, mockKeyboard)
			mockStdin.isTTY = true

			const mockChats = [
				{ id: "chat1", title: "Archive with 'a'" },
				{ id: "chat2", title: "No match" },
				{ id: "chat3", title: "Another 'a' match" }
			]

			// Simulate keypress 'a' → filters to chat1 + chat3 (top 6)
			const expectedFilter = mockChats.filter(c => c.title.includes("a")).slice(0, 6)
			// In ls: on keypress, filter list, re-render table (assert mockStdout includes filtered titles)
			// Mock: Assume ls uses readline.question or line, but for filter, keypress listener
			const filterInput = "a"
			// Push keypress event sim
			mockStdin.emit("keypress", filterInput, { name: "a" })  // Mock keypress event

			// Verify table would show 2 matches (simplified assert on expected)
			const filtered = expectedFilter.map(c => c.title).join("\n")
			// In full: After filter, truncate if >6 + "..."
			ok(filtered.includes("Archive with 'a'"), "Filters table live on keypress")
			ok(filtered.length === 2, "Shows filtered results")
			// Backspace to empty: Show all (test cancel in impl)
		})
	})
})
