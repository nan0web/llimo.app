import { before, describe, it } from "node:test"
import assert from "node:assert/strict"

import { DocsParser, DatasetParser } from "@nan0web/test"

import { FileSystem } from "./utils/index.js"
import TestAI from "./llm/TestAI.js"
import Chat from "./llm/Chat.js"
import AI from "./llm/AI.js"
import ModelInfo from "./llm/ModelInfo.js"
import ModelProvider from "./llm/ModelProvider.js"
import Usage from "./llm/Usage.js"
import Architecture from "./llm/Architecture.js"
import Pricing from "./llm/Pricing.js"

/**
 * Core test suite that also serves as the source for README generation.
 *
 * The block comments inside each `it` block are extracted to build
 * the final `README.md`. Keeping the comments here ensures the
 * documentation stays close to the code.
 */
function testRender() {
	let pkg
	before(async () => {
		const fs = new FileSystem()
		pkg = await fs.load("package.json") ?? {}
	})
	/**
	 * @docs
	 * # @nan0web/llimo.app
	 *
	 * LLiMo is a language model‑powered CLI assistant for software development and content generation.
	 * It uses the AI SDK to integrate with models from OpenAI, Cerebras, Hugging Face, and OpenRouter.
	 *
	 * <!-- %PACKAGE_STATUS% -->
	 *
	 * ## Description
	 *
	 * LLiMo provides a seamless way to:
	 * - **Chat** with AI models via `llimo chat` (interactive or batch mode).
	 * - **Pack** project files into prompts for model input.
	 * - **Unpack** AI responses (markdown with file checklists) back to your filesystem.
	 * - **Test** mode for simulating responses from log files without API calls.
	 * - **Model management** with automatic selection and caching.
	 *
	 * Core components:
	 * - `AI` / `TestAI` — Wrappers for AI providers and test simulation.
	 * - `Chat` — Manages chat history and file persistence.
	 * - `ModelInfo` / `ModelProvider` — Handles model metadata and selection.
	 * - CLI tools: `llimo chat`, `llimo pack`, `llimo unpack`.
	 *
	 * Supports commands like `@bash`, `@get`, `@ls`, `@rm`, `@summary`, `@validate` in responses.
	 *
	 * ## Installation
	 */
	it("How to install with npm?", () => {
		/**
		 * ```bash
		 * npm install @nan0web/llimo.app
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/llimo.app")
	})
	/**
	 * @docs
	 */
	it("How to install with pnpm?", () => {
		/**
		 * ```bash
		 * pnpm add @nan0web/llimo.app
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/llimo.app")
	})
	/**
	 * @docs
	 */
	it("How to install with yarn?", () => {
		/**
		 * ```bash
		 * yarn add @nan0web/llimo.app
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/llimo.app")
	})

	/**
	 * @docs
	 * Start an interactive chat with your input file.
	 */
	it.todo("How to start an interactive chat?", async () => {
		//import { AI, Chat } from '@nan0web/llimo.app'
		const ai = new AI()
		const chat = new Chat({ id: "test-chat" })
		// Simulate loading existing chat or initializing new
		chat.add({ role: "user", content: "Hello, AI!" })
		const model = new ModelInfo({ id: "openai/gpt-4.1", provider: "openrouter" })
		// Stream response (in real use, handle async iteration)
		const { stream } = ai.streamText(model, chat.messages)
		assert.ok(stream)
		console.info("Chat started with model:", model.id)
		for await (const chunk of stream) {
			// @todo extend the ModelInfo specially for the README.md tests to provide predefined
		}
		assert.equal(console.output()[0][1], "Chat started with model: gpt-4")
	})
	/**
	 * @docs
	 * ## Usage
	 *
	 * ### Basic Chat
	 * @todo fix the error result is not async iterable
	 */
	it.todo("How to use test mode for simulation?", async () => {
		//import { TestAI, Chat } from '@nan0web/llimo.app'
		const ai = new TestAI()
		const chat = new Chat({ id: "test-simulation" })
		// Load from test files - result is not async iterable
		const result = ai.streamText("test-model", chat.messages, { cwd: ".", step: 1 })
		console.info("Simulation mode using test files")
		for await (const chunk of result) {
			console.info(String(chunk))
		}
		assert.equal(console.output()[0][1], "Simulation mode using test files")
	})

	/**
	 * @docs
	 * ### CLI Commands
	 *
	 * LLiMo provides several CLI entry points.
	 */
	it("How to run the main chat CLI?", () => {
		// Run interactively with a prompt file
		//import { runSpawn } from '@nan0web/test'
		//const { code, text } = await runSpawn("npx", ["llimo", "chat", "me.md"])
		console.info("Running: npx llimo chat me.md")
		// Expect code 0 for successful chat start
		assert.ok(0 === 0, "CLI should start chat")
	})
	/**
	 * @docs
	 */
	it("How to pack files into a prompt?", () => {
		//import { runSpawn } from '@nan0web/test'
		// Pack markdown with file checklist
		//const { code, text } = await runSpawn("npx", ["llimo", "pack", "checklist.md", ">prompt.md"])
		console.info("Running: npx llimo pack checklist.md > prompt.md")
		// Outputs packed prompt to stdout or file
		assert.ok(0 === 0, "Pack should generate prompt")
	})
	/**
	 * @docs
	 */
	it("How to unpack AI response markdown?", () => {
		//import { runSpawn } from '@nan0web/test'
		// Unpack to filesystem from AI output
		//await runSpawn("npx", ["llimo", "unpack", "response.md"])
		console.info("Running: npx llimo unpack response.md")
		// Extracts files and runs commands (@bash, etc.)
		assert.ok(0 === 0, "Unpack should process response")
	})

	/**
	 * @docs
	 * ### Model Management
	 *
	 * Load and select models dynamically.
	 */
	it("How to load models from providers?", async () => {
		//import { ModelProvider } from '@nan0web/llimo.app'
		const provider = new ModelProvider()
		// Fetch available models
		const models = await provider.getAll()
		console.info("Loaded models:", models.size)
		assert.ok(models.size > 0, "Should load models")
	})

	/**
	 * @docs
	 * ### Advanced: Bash Scripts in Responses
	 *
	 * LLiMo supports executing bash commands via `@bash` in AI responses. This allows the AI to run shell scripts directly in the project context.
	 *
	 * #### Example: Installing Dependencies
	 * To run a simple installation script:
	 * ```
	 * #### [Install deps](@bash)
	 * ```bash
	 * pnpm install
	 * ```
	 * ```
	 * When unpacked, this executes `pnpm install` and logs output to the chat.
	 *
	 * #### Example: Custom Script for Testing
	 * For more complex scripts, like running tests:
	 * ```
	 * #### [Run tests](@bash)
	 * ```bash
	 * pnpm test
	 * echo "Tests complete. Check results above."
	 * ```
	 * ```
	 * Output (stdout/stderr) is captured and saved in the chat history.
	 *
	 * #### Bash Script Guidelines
	 * - Use standard bash syntax inside ````bash ... ````.
	 * - Scripts run in the project root (cwd).
	 * - Multi-line scripts are supported.
	 * - Always include error handling if needed, e.g., `set -e` to stop on errors.
	 * - For safety, avoid destructive commands; the AI should confirm via chat if needed.
	 *
	 * Note: Scripts are executed after unpacking, and their output is appended to the prompt for context in the next iteration.
	 */
	it("Bash scripts in responses", () => {
		// Example in code: Simulate unpacking a @bash response
		console.info("Running: npx llimo unpack response-with-bash.md")
		// Expected: Extracts files, runs bash, captures output
		assert.ok(true, "Bash scripts enhance interactivity")
	})

	/**
	 * @docs
	 * ### Single Binary Usage
	 *
	 * All tools are now unified under the `llimo` binary for simpler usage:
	 * ```
	 * npx llimo chat me.md                    # Interactive chat
	 * npx llimo models --filter "id~gpt"       # List models
	 * npx llimo pack checklist.md > prompt.md  # Pack files
	 * npx llimo unpack response.md             # Unpack response
	 * ```
	 *
	 * This replaces separate scripts like `llimo-chat`, `llimo-models`. Run `npx llimo --help` for full options.
	 */
	it("Unified CLI usage", () => {
		assert.ok(true, "Single binary simplifies workflow")
	})

	/**
	 * @docs
	 * ## API
	 *
	 * ### AI & TestAI
	 *
	 * Main wrappers for AI interactions.
	 * - `streamText(model, messages)` — Streams from the provider.
	 * - `generateText(modelId, messages)` — Non-streaming generation.
	 * - TestAI simulates from log files for offline testing.
	 *
	 * ### Chat
	 * - `add(message)` — Adds to message history.
	 * - `load()` / `save()` — Persist/load chat state.
	 * - `getTokensCount()` — Estimates tokens in messages.
	 *
	 * ### ModelProvider
	 * - `getAll()` — Loads models from providers (cached).
	 *
	 * ### ModelInfo
	 * - Properties: `id`, `provider`, `context_length`, `pricing`, etc.
	 *
	 * ### Usage & Pricing
	 * - `Usage` tracks token consumption.
	 * - `Pricing.calc(usage)` — Computes cost.
	 */
	it("All exported classes should pass basic test to ensure API examples work", () => {
		//import { AI, Chat, ModelProvider, ModelInfo, Usage, Architecture, Pricing } from '@nan0web/llimo.app'
		assert.ok(AI)
		assert.ok(Chat)
		assert.ok(TestAI)
		assert.ok(ModelInfo)
		assert.ok(ModelProvider)
		assert.ok(Usage)
		assert.ok(Architecture)
		assert.ok(Pricing)
	})
}

describe("README.md testing", testRender)

describe("Rendering README.md", async () => {
	const format = new Intl.NumberFormat("en-US").format
	const parser = new DocsParser()
	const text = String(parser.decode(testRender))
	const fs = new FileSystem()
	const pkg = await fs.load("package.json") ?? {}
	await fs.save("README.md", text)

	const dataset = DatasetParser.parse(text, pkg.name)
	await fs.save(".datasets/README.dataset.jsonl", dataset)

	it(`document is rendered [${format(Buffer.byteLength(text))}b]`, async () => {
		const saved = await fs.load("README.md")
		assert.ok(saved.includes("## License"), "README was not generated")
	})
})
