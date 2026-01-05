import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { selectModel } from "./selectModel.js"
import { ModelInfo } from "./ModelInfo.js"
import { Ui }from "../cli/Ui.js"

describe("selectModel – model/provider selection logic", () => {
	let cwd

	beforeEach(async () => {
		cwd = await mkdtemp(resolve(tmpdir(), "llimo-select-"))
	})

	afterEach(async () => {
		if (cwd) await rm(cwd, { recursive: true, force: true })
	})

	/** Helper – creates a minimal ModelInfo map */
	function makeMap(models) {
		const map = new Map()
		for (const m of models) {
			const mi = new ModelInfo(m)
			map.set(mi.id, mi)
		}
		return map
	}

	describe("basic selection", () => {
		it("returns undefined when no model matches", async () => {
			const map = makeMap([{ id: "other-model", provider: "other" }])
			const testUi = { ...new Ui(), ask: mock.fn(async () => "invalid") } // wrong to trigger throw from multiple=0, but for no match, no prompt
			const result = await selectModel(map, "nonexistent", undefined, testUi)
			assert.equal(result, undefined)
		})

		it("returns the sole match without prompting", async () => {
			const map = makeMap([
				{ id: "unrelated" },
				{ id: "cerebras-model", provider: "cerebras" },
			])
			const testUi = new Ui()

			const chosen = await selectModel(map, "cerebras", undefined, testUi, () => {})
			assert.strictEqual(chosen.id, "cerebras-model")
		})

		it("asks user when several candidates, respects numeric choice", async () => {
			const map = makeMap([
				{ id: "other-1", provider: "a" },
				{ id: "gpt-oss-120b", provider: "openai" },
				{ id: "gpt-oss-40b", provider: "openai" },
				{ id: "other-2", provider: "b" },
			])
			const ui = new Ui()
			ui.ask = async () => "2" // second in filtered list: gpt-oss-40b

			const chosen = await selectModel(map, "oss", undefined, ui, () => {})
			assert.strictEqual(chosen.id, "gpt-oss-40b") // second after filter
		})

		it("handles direct ID input", async () => {
			const map = makeMap([
				{ id: "test1" },
				{ id: "exact-match", provider: "test" },
				{ id: "test2" },
			])
			const mockUiDirect = {
				...new Ui(),
				ask: async () => "exact-match" // direct ID
			}

			const chosen = await selectModel(map, "", "", mockUiDirect, () => {})
			assert.strictEqual(chosen.id, "exact-match")
		})
	})
})

