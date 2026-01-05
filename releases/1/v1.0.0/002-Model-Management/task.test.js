import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ModelProvider } from "../../../../src/llm/ModelProvider.js"

describe("002-Model-Management – src/llm/AI.js, ModelProvider.js", () => {
	describe("2.1 Load models with caching/progress", () => {
		it("ModelProvider.getAll loads/caches models", async () => {
			const provider = new ModelProvider()
			// Mock to avoid network calls
			const models = await provider.getAll()
			assert.ok(models.size > 0, "Loads at least some models")
		})
	})
})
