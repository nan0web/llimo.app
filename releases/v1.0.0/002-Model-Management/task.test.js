import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "../../..")

describe("002-Model-Management – src/llm/AI.js, ModelProvider.js", () => {
	describe("2.1 Load models with caching/progress", () => {
		it("ModelProvider.getAll loads/caches models", async () => {
			const providerPath = resolve(rootDir, "src/llm/ModelProvider.js")
			const { default: Model
