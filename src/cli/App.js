import process from "node:process"
import { Git, FileSystem } from "../utils/index.js"
import { GREEN, RESET, MAGENTA } from "./ANSI.js"
import { Ui } from "./Ui.js"
import UiOutput from "./UiOutput.js"
import { runCommand } from "./runCommand.js"
import { selectAndShowModel } from "./selectModel.js"
import {
	AI, TestAI, Chat, packMarkdown,
	initialiseChat, copyInputToChat, packPrompt,
	handleTestMode, sendAndStream,
	readInput,
	ModelInfo, Architecture, Pricing,
	decodeAnswer,
	decodeAnswerAndRunTests,
	ModelProvider,
} from "../llm/index.js"
import { loadModels, ChatOptions } from "../Chat/index.js"
import { InfoCommand } from "../Chat/commands/info.js"
import { TestCommand } from "../Chat/commands/test.js"

// const DEFAULT_MODEL = "gpt-oss-120b"
// const DEFAULT_MODEL = "zai-glm-4.6"
// const DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"
// const DEFAULT_MODEL = "qwen-3-32b"
// const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
// const DEFAULT_MODEL = "x-ai/grok-4-fast"
// const DEFAULT_MODEL = "openai/gpt-oss-20b:free"
const DEFAULT_MODEL = "gpt-oss-120b"
const DEFAULT_PROVIDER = "cerebras"

export class ChatCLiApp {
	/** @type {FileSystem} */
	fs
	/** @type {Git} */
	git
	/** @type {Ui} */
	ui
	/** @type {AI} */
	ai
	/** @type {ChatOptions} */
	options
	/** @type {Chat} */
	chat
	/** @type {string} */
	input
	/** @type {string} */
	inputFile
	/** @type {(value: number | bigint) => string} */
	#format
	/** @type {(value: number | bigint) => string} */
	#valuta
	/** @type {Array<{step: number, model: ModelInfo, prompt: string}>} */
	#steps = []
	/** @param {Partial<ChatCLiApp>} props */
	constructor(props) {
		const {
			fs,
			git,
			ui,
			ai,
			options,
			chat = new Chat({}),
			input = "",
			inputFile = "",
		} = props
		this.fs = fs ?? new FileSystem()
		this.git = git ?? new Git()
		this.ui = ui ?? new Ui()
		this.ai = ai ?? new AI()
		this.options = new ChatOptions(options)
		this.chat = chat
		this.input = String(input)
		this.inputFile = inputFile
		this.#format = new Intl.NumberFormat("en-US").format
		this.#valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format
	}
	async init(input) {
		const { isNew, isYes } = this.options
		const { chat } = await initialiseChat({ ui: this.ui, ChatClass: Chat, fs: this.fs, isNew })
		this.chat = chat

		let shouldContinue = await this.runCommandFirst(input)
		if (!shouldContinue) {
			return false
		}

		await this.initAI(isYes)
		return true
	}
	/**
	 * Run the command before the chat, such as info, test.
	 * Returns `false` if no need to continue with chat, and `true` if continue.
	 * @param {string[]} input
	 * @returns {Promise<boolean>}
	 */
	async runCommandFirst(input) {
		const commands = [
			InfoCommand,
			TestCommand,
		]
		let shouldContinue = true
		const found = commands.find(c => c.name === this.options.argv[0])
		if (found) {
			this.options.argv.shift()
			// process the specific command before chatting
			const cmd = found.create({ argv: input ?? [], chat: this.chat })
			for await (const chunk of cmd.run()) {
				if (typeof chunk === "boolean") {
					shouldContinue = chunk
					this.ui.console.debug(`[shouldContinue = ${shouldContinue ? 'yes' : 'no'}]`)
					break
				}
				else if (chunk instanceof UiOutput) {
					chunk.renderIn(this.ui)
				}
				else {
					this.ui.console.info(chunk)
				}
			}
		}

		if (!shouldContinue) {
			return false
		}
		return shouldContinue
	}
	async initAI(isYes = false) {
		/** @type {AI} */
		if (!this.ai) {
			this.ai = new AI()
		}
		const models = await loadModels(this.ui)
		this.ai.setModels(models)
		// Fixed pre-select: prioritize chat.config.model if available from loaded chat
		const savedModel = await this.chat.load("model.json") ?? {}
		const modelStr = this.options.model ||
			(this.chat.config?.model || savedModel.id) || // Load from saved model
			process.env.LLIMO_MODEL ||
			DEFAULT_MODEL
		const providerStr = this.options.provider || this.chat.config?.provider || process.env.LLIMO_PROVIDER || DEFAULT_PROVIDER
		const onSelect = (model) => {
			this.chat.config.model = model.id
			this.chat.config.provider = model.provider
		}
		if (isYes) {
			const model = this.ai.getProviderModel(modelStr, providerStr)
			if (!model) {
				throw new Error(`Model not found for ${modelStr}@${providerStr}`)
			}
			this.ai.selectedModel = model
			this.chat.save("model.json", model) // Persist for pre-select
			return
		}
		// Interactive selection, but pre-load chat model if available
		const preLoaded = await this.chat.load("model.json")
		if (preLoaded) {
			this.ai.selectedModel = preLoaded
			onSelect(preLoaded)
		} else {
			this.ai.selectedModel = await selectAndShowModel(this.ai, this.ui, modelStr, providerStr, onSelect)
		}
	}
	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	async readInput() {
		// 1. read input (stdin / file) - use cleanArgv to avoid flags
		try {
			const { input, inputFile } = await readInput(this.options.argv, this.fs, this.ui)
			this.input = input
			this.inputFile = inputFile ?? ""
		} catch (err) {
			const { input, inputFile } = await readInput(["me.md"], this.fs, this.ui)
			this.input = input
			this.inputFile = inputFile ?? ""
		}
		if (undefined === this.input) {
			return false
		}

		await this.chat.save("input.md", this.input)
		const testChatDir = this.options.testDir || this.chat.dir  // Use provided dir or current chat.dir

		if (this.options.isTest) {
			const dummyModel = new ModelInfo({
				id: "test-model",
				pricing: new Pricing({ prompt: 0, completion: 0 }),
				architecture: new Architecture({ modality: "text" })
			})
			await handleTestMode({
				ai: this.ai, ui: this.ui, cwd: testChatDir, input: this.input, chat: this.chat,
				model: dummyModel, fps: 33
			})
			return false
		}
		// Normal real AI mode continues...
		return true
	}
	/**
	 * Returns True to continue chat and False to stop the chat.
	 * @param {string} prompt
	 * @param {ModelInfo} model
	 * @param {number} [step=1]
	 * @returns {Promise<boolean>}
	 */
	async prepare(prompt, model, step = 1) {
		await this.chat.save({
			input: this.input,
			prompt,
			model: this.ai.selectedModel ?? undefined,
			step,
			messages: []
		})
		this.ui.console.info(`\nstep ${step}. ${new Date().toISOString()}`)
		this.ui.console.info(`\nsending (streaming) [${model.id}](@${model.provider}) ${this.ui.formats.weight("T", model.context_length)}`)

		// Show batch discount information
		const discount = model.pricing.getBatchDiscount()
		if (discount[0] || discount[1]) {
			this.ui.console.info(`\n! batch processing has ${discount[0]}% read | ${discount[1]} write discount compared to streaming\n`)
		}
		if (!this.options.isYes) {
			const ans = await this.ui.askYesNo(`${MAGENTA}Send prompt to LLiMo? (Y)es, No: ${RESET}`)
			if ("yes" !== ans) return false
		}
		return true
	}
	/**
	 * Decodes the answer and return the next prompt
	 * @param {import("../llm/chatLoop.js").sendAndStreamOptions} sent
	 * @param {number} [step=1]
	 * @returns {Promise<{ answer: string, shouldContinue: boolean, logs: string[], prompt: string }>}
	 */
	async unpack(sent, step = 1) {
		this.chat.add({ role: "assistant", content: sent.answer })
		await this.chat.save()
		this.ui.console.info("")
		if (sent.reason) {
			this.ui.console.info(`+ reason (${this.chat.path("reason.md", step)})`)
		}
		this.ui.console.info(`+ answer (${this.chat.path("answer.md", step)})`)
		return await decodeAnswer({ ui: this.ui, chat: this.chat, options: this.options })
	}
	/**
	 *
	 * @param {string} prompt
	 * @param {ModelInfo} model
	 * @param {number} [step=1]
	 * @returns {Promise<import("../llm/chatLoop.js").sendAndStreamOptions>}
	 */
	async send(prompt, model, step = 1) {
		// 6. send messages and see the stream progress
		const streamed = await sendAndStream({
			ai: this.ai, chat: this.chat, ui: this.ui, step, prompt,
			format: this.#format, valuta: this.#valuta, model
		})
		if (streamed.reason) {
			this.ui.console.info(`+ reason (${this.chat.path("reason.md", step)})`)
		}
		// Save step info including model
		this.#steps.push({ step, model, prompt })
		await this.chat.save("steps.jsonl", this.#steps)
		return streamed
	}
	/**
	 *
	 * @param {number} [step=1]
	 * @returns {Promise<{ shouldContinue: boolean, test: import("../llm/chatSteps.js").TestOutput }>}
	 */
	async test(step = 1) {
		// @todo use the small progress window
		const onData = (d) => this.ui.write(String(d))
		const tested = await decodeAnswerAndRunTests(
			this.ui,
			this.chat,
			async (cmd, args, opts = {}) => runCommand(cmd, args, { ...opts, onData }),
			this.options,
			step
		)
		const { test } = tested
		if (true === tested.testsCode) {
			// Task is complete, let's commit and exit
			this.ui.console.info(`  ${GREEN}+ Task is complete${RESET}`)
			await this.git.commitAll("Task is complete")
			return { shouldContinue: false, test }
		} else {
			let consecutiveErrors = 0 // Assume tracked in caller
			const MAX_ERRORS = 9
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				this.ui.console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				// @todo write fail log
				return { shouldContinue: false, test }
			}
		}
		return { shouldContinue: true, test }
	}
	/**
	 *
	 * @param {import("../llm/chatSteps.js").TestOutput} tested
	 * @param {number} [step=1]
	 */
	async next(tested, step = 1) {
		// Load test output to provide feedback for fixing
		this.chat.save("fail", {
			fail: tested.logs.fail,
			cancelled: tested.logs.cancelled,
			types: tested.logs.types
		}, step)

		const rows = [
			"Test results:",
			Object.entries(tested.counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")
		]
		if (tested.logs.fail.length) {
			rows.push("Fail tests:")
			tested.logs.fail.forEach(e => rows.push(`- ${e.str}`))
		}
		if (tested.logs.cancelled.length) {
			rows.push("Cancelled tests:")
			tested.logs.cancelled.forEach(e => rows.push(`- ${e.str}`))
		}
		if (tested.logs.types.length) {
			rows.push("Types tests:")
			tested.logs.types.forEach(e => rows.push(`- ${e.str}`))
		}

		// Pack the next input (original or test feedback)
		const packed = await packPrompt(packMarkdown, rows.join("\n"), this.chat, this.ui)
		await this.chat.save("prompt.md", packed.packedPrompt)
	}
	/**
	 * Starts the chat:
	 * 1. Detect the recent step
	 * 1.1. for Test it should go from the first step
	 * 1.2. for Real it should go from the recent step
	 * 2. Prepare input (pack prompt with messages)
	 * 3. Select a model
	 * 3.1. for Test it should be selected from saved log
	 * 3.2. for Real it should use available by the algorithm
	 */
	async start() {
		let step = this.chat.assistantMessages.length + 1
		await copyInputToChat(this.inputFile, this.input, this.chat, this.ui, step)

		// 4. pack prompt – prepend system.md if present
		let packed = await packPrompt(packMarkdown, this.input, this.chat, this.ui)
		let prompt = packed.packedPrompt
		await this.chat.save("prompt.md", prompt)

		// 5. chat loop – refactored

		const model = this.ai.selectedModel
		if (!model) {
			throw new Error("LLiMo model is not selected, provide it in env variable LLIMO_MODEL=gpt-oss-120b")
		}

		return { step, prompt, model }
	}
	async loop() {
		// 3. copy source file to chat directory (if any)
		let { step, prompt, model } = await this.start()
		while (true) {
			let shouldContinue = await this.prepare(prompt, model, step)
			if (!shouldContinue) break
			const sent = await this.send(prompt, model, step)
			const unpacked = await this.unpack(sent, step)
			if (!unpacked.shouldContinue) break
			const tested = await this.test(step)
			if (!tested.shouldContinue) break
			await this.next(tested.test, step)
			++step
		}
		// Save final steps.jsonl
		await this.chat.save("steps.jsonl", this.#steps)
	}
}

export default ChatCLiApp

