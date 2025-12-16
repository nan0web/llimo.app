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
const DEFAULT_MODEL = "gpt-oss-120b"

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
		const { isNew } = this.options
		const { chat } = await initialiseChat({ ui: this.ui, ChatClass: Chat, fs: this.fs, isNew })
		this.chat = chat

		let sholdContinue = await this.runCommandFirst(input)
		if (!sholdContinue) {
			return false
		}

		await this.initAI()
	}
	async runCommandFirst(input) {
		const commands = [
			InfoCommand,
			TestCommand,
		]
		let shouldContinue = true
		const found = commands.find(c => c.name === this.options.argv[0])
		if (found) {
			// process the specific command before chatting
			const cmd = found.create({ argv: input ?? [], chat: this.chat })
			for await (const chunk of cmd.run()) {
				if ("boolean" === typeof chunk) {
					shouldContinue = chunk
					this.ui.console.debug(`[shouldContinue = ${chunk ? 'yes' : 'no'}]`)
					continue
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
	async initAI(defaultModel = "gpt-oss-120b") {
		/** @type {AI} */
		if (!this.ai.selectedModel) {
			if (this.options.isTest) {
				this.ui.console.info(`${GREEN}🧪 Test mode enabled with chat directory: ${this.options.testDir}${RESET}`)
				this.ai = new TestAI({})
			} else {
				const modelStr = this.options.model || process.env.LLIMO_MODEL || this.chat.config?.model || defaultModel
				const providerStr = this.options.provider || process.env.LLIMO_PROVIDER || this.chat.config?.provider || ""
				const models = await loadModels(this.ui)
				const onSelect = (model) => {
					this.chat.config.model = model.id
					this.chat.config.provider = model.provider
				}
				this.ai = new AI({ models })
				this.ai.selectedModel = await selectAndShowModel(this.ai, this.ui, modelStr, providerStr, onSelect)
			}
		}
	}
	async readInput() {
		// 1. read input (stdin / file) - use cleanArgv to avoid flags
		const { input, inputFile } = await readInput(this.options.argv, this.fs, this.ui)
		this.input = input
		this.inputFile = inputFile ?? ""

		await this.chat.save("input.md", input)
		const testChatDir = this.options.testDir || this.chat.dir  // Use provided dir or current chat.dir

		if (this.options.isTest) {
			const dummyModel = new ModelInfo({
				pricing: new Pricing({ prompt: 0, completion: 0 }),
				architecture: new Architecture({ modality: "text" })
			})
			await handleTestMode({
				ai: this.ai, ui: this.ui, cwd: testChatDir, input, chat: this.chat,
				model: dummyModel, fps: 33
			})
			return false
		}
		// Normal real AI mode continues...
		// const model = this.ai.selectedModel || this.ai.findModel(model)
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
	async loop() {
		let step = this.chat.assistantMessages.length + 1
		// 3. copy source file to chat directory (if any)
		await copyInputToChat(this.inputFile, this.input, this.chat, this.ui, step)

		// 4. pack prompt – prepend system.md if present
		let packed = await packPrompt(packMarkdown, this.input, this.chat, this.ui)
		let prompt = packed.packedPrompt
		await this.chat.save("prompt.md", prompt)

		// 5. chat loop – refactored

		const model = this.ai.selectedModel
		if (!model) {
			return false
		}

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
	}
}

export default ChatCLiApp
