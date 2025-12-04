import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { selectModel } from "./selectModel.js"
import FileSystem from "../utils/FileSystem.js"
import ModelInfo from "./ModelInfo.js"
import Ui from "../cli/Ui.js"

describe("selectModel – model/provider selection logic", () => {
	let cwd
	const ui = new Ui()
	const mockUi = {
		...ui,
		askYesNo: async (msg) => "1", // default selection for multiple‑choice tests
	}

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

	it("throws when no model matches", async () => {
		const map = makeMap([
			{ id: "gpt-oss-120b", provider: "openai" },
			{ id: "cerebras-1", provider: "cerebras" },
		])
		const fs = new FileSystem({ cwd })

		await assert.rejects(
			() => selectModel(map, "nonexistent", undefined, ui, fs),
			{
				message: /No models match the criteria/
			}
		)
	})

	it("returns the sole match without prompting", async () => {
		const map = makeMap([
			{ id: "gpt-oss-120b", provider: "openai" },
			{ id: "cerebras-1", provider: "cerebras" },
		])
		const fs = new FileSystem({ cwd })

		const chosen = await selectModel(map, "cerebras", undefined, ui, fs)
		assert.strictEqual(chosen.id, "cerebras-1")
		assert.strictEqual(chosen.provider, "cerebras")
	})

	it("asks user when several candidates, respects numeric choice", async () => {
		const map = makeMap([
			{ id: "gpt-oss-120b", provider: "openai" },
			{ id: "gpt-oss-40b", provider: "openai" },
			{ id: "cerebras-1", provider: "cerebras" },
		])
		const fs = new FileSystem({ cwd })

		const chosen = await selectModel(map, "oss", undefined, mockUi, fs)
		// mockUi will answer "1" → first entry in the filtered list
		assert.strictEqual(chosen.id, "gpt-oss-120b")
		// Verify that the config file was written
		const cfg = await fs.load(".cache/llimo.json")
		assert.deepStrictEqual(cfg, { model: "gpt-oss-120b", provider: "openai" })
	})
})
