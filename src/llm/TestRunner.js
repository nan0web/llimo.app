import process from "node:process"

import { packMarkdown } from "./pack.js"
import { packPrompt } from "./chatSteps.js"
import { unpackAnswer } from "./unpack.js"
import Chat from "./Chat.js"
import TestAI from "./TestAI.js"
import Markdown from "../utils/Markdown.js"
import { BLUE, DIM, GREEN, ITALIC, RED, RESET, YELLOW } from "../cli/ANSI.js"
import { createTempWorkspace, cleanupTempDir } from "../test-utils.js"
import FileSystem from "../utils/FileSystem.js"
import Ui from "../cli/Ui.js"

class Formats {
	static NumberFormat = new Intl.NumberFormat("en-US").format
	static IntFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format
}

/**
 * @typedef {"byte" | "token"} Unit
 */
class Weight {
	value
	/** @type {Unit} */
	unit
	constructor(input = {}) {
		const {
			value = 0,
			unit = "byte",
		} = input
		this.value = Number(value)
		this.unit = "token" === unit ? "token" : "byte"
	}
	toString() {
		const suffix = "token" == this.unit ? "T" : "b"
		return Formats.IntFormat(this.value) + suffix
	}
}

/**
 * Calculate weight of messages.
 * @param {import("ai").ModelMessage[]} messages
 * @param {Unit} unit - Unit for weight calculation
 * @returns {Weight}
 */
function weight(messages, unit = "byte") {
	return new Weight({ value: messages.reduce((a, v) => a += String(v.content).length, 0), unit })
}

/**
 * Handles testing operations for a chat directory: info, unpack simulation, and full test simulation.
 */
export default class TestRunner {
	/** @type {string} */
	chatDir
	/** @type {object} */
	options
	/** @type {Ui} */
	ui
	/** @type {FileSystem} */
	fs

	/**
	 * @param {Ui} ui
	 * @param {string} chatDir
	 * @param {object} options
	 */
	constructor(ui, chatDir, options) {
		this.options = options
		this.ui = ui
		const fs = new FileSystem()
		this.chatDir = fs.path.resolve(chatDir)
		this.fs = new FileSystem({ cwd: this.chatDir })
	}

	/**
	 * Run the operation based on mode.
	 */
	async run() {
		let testChatDir = this.chatDir
		let cleanupTemp = null

		try {
			if (this.options.mode === "test") {
				const chatId = this.fs.path.basename(this.chatDir)
				const tempDir = await createTempWorkspace({})

				const tempChatDir = this.fs.path.resolve(tempDir, chatId)
				const tempFs = new FileSystem({ cwd: tempChatDir })
				const files = await this.fs.browse(".", { recursive: true })

				cleanupTemp = () => {
					cleanupTempDir(tempDir)
					this.ui.console.info(`${BLUE}- ${files.length} files within ${tempDir}${RESET}`)
				}

				this.ui.console.style(BLUE)
				this.ui.console.info("Creating temporary copy of the selected chat")
				this.ui.console.info(`+ ${tempDir}`)
				this.ui.console.info(`  + /${chatId}`)
				this.ui.console.style()

				for (const file of files) {
					if (file.endsWith("/")) continue
					const content = await this.fs.load(file)
					await tempFs.save(file, content)
					const stats = await tempFs.info(file)
					this.ui.console.debug(`    ${BLUE}${DIM}${stats.isFile() ? '+' : '-'} ${file}${RESET}`)
				}
				testChatDir = tempChatDir
				this.fs = new FileSystem({ cwd: tempChatDir })
			}

			const id = this.fs.path.basename(testChatDir)
			const chat = new Chat({ id, dir: testChatDir })
			const loaded = await chat.load()
			if (loaded) {
				this.ui.console.info(`Chat ${chat.id} loaded`)
				const rows = [
					[`+ ${chat.messages.length}`, "message(s)", `(${ITALIC}${weight(chat.messages, "byte")}${RESET})`],
					[chat.systemMessages.length, "system message(s)", `(${ITALIC}${weight(chat.systemMessages, "byte")}${RESET})`],
					[chat.userMessages.length, "user message(s)", `(${ITALIC}${weight(chat.userMessages, "byte")}${RESET})`],
					[chat.assistantMessages.length, "assistant message(s)", `(${ITALIC}${weight(chat.assistantMessages, "byte")}${RESET})`],
					[chat.toolMessages.length, "tool message(s)", `(${ITALIC}${weight(chat.toolMessages, "byte")}${RESET})`],
				]
				this.ui.console.table(rows, { aligns: ["right", "left", "right"], divider: 3 })
			} else {
				throw new Error(`Cannot read chat ${id}`)
			}

			switch (this.options.mode) {
				case "info":
					await this.showInfo(chat)
					break
				case "unpack":
					await this.simulateUnpack(chat)
					break
				case "test":
					await this.simulateTest(chat)
					break
				default:
					this.ui.console.error(`Unknown mode: ${this.options.mode}`)
					process.exit(1)
			}
		} catch (error) {
			throw error // Re-throw for tests to catch
		} finally {
			if (cleanupTemp) cleanupTemp()
		}
	}

	/**
	 * @param {Chat} chat
	 */
	async showInfo(chat) {
		this.ui.console.info(`Chat info for ${this.chatDir}`)

		let totalTokens = 0
		let step = 0
		let groups = new Map()
		let files = 0
		const userSteps = []
		for (let i = 0; i < chat.messages.length; i++) {
			const msg = chat.messages[i]
			const tokens = Math.round(msg.content.length / 4)
			totalTokens += tokens
			const count = groups.get(msg.role) ?? 0
			groups.set(msg.role, count + tokens)
			const parsed = await Markdown.parse(String(msg.content))
			const atts = parsed.files?.size ?? 0
			files += atts
			if (msg.role === "user") {
				step++
				userSteps.push({ step, tokens })
			}
			const str = Array.from(groups.entries()).map(
				([name, num]) => `${name}: ${this.ui.formats.weight("T", num)}T`
			).join(", ")
			this.ui.console.info(`${step}. [${msg.role}] ${str}; ${atts}:${files} file(s) (total: ${this.ui.formats.weight("T", totalTokens)}T)`)
		}
		this.ui.console.info(`Total estimated tokens: ${totalTokens}`)
		this.ui.console.info(`Available step data: ${userSteps.length}`)

		if (this.options.step > 0) {
			const stepInfo = userSteps.find((s) => s.step === this.options.step)
			if (!stepInfo) {
				this.ui.console.warn(`Step ${this.options.step} exceeds history (${userSteps.length} user messages)`)
			} else {
				this.ui.console.info(`Step ${this.options.step}: ${stepInfo.tokens} tokens`)
			}
		}
	}

	async simulateUnpack(chat) {
		const { fullResponse, parsed } = await this.simulateStep(chat)
		this.ui.console.info(`${GREEN}Simulating unpack for step ${this.options.step}${RESET}`)

		const outputDir = this.options.outputDir || this.fs.path.resolve(this.chatDir, `unpack-step${this.options.step}`)
		await this.fs.mkdir(outputDir, { recursive: true })

		const stream = unpackAnswer(parsed, false, outputDir)
		for await (const line of stream) {
			this.ui.console.info(line)
		}
		this.ui.console.info(`${GREEN}✅ Unpack simulation complete, files in ${outputDir}${RESET}`)
	}

	async simulateTest(chat) {
		await this.simulateUnpack(chat)
		this.ui.console.info(`${GREEN}Simulating tests for step ${this.options.step}${RESET}`)

		const testFile = `step/${String(this.options.step).padStart(3, '0')}/tests.txt`
		/** @type {string | Error | undefined} */
		let testOutput
		try {
			if (this.fs.load && await this.fs.exists(testFile)) {
				testOutput = await this.fs.load(testFile)
			}
			if (!testOutput) {
				testOutput = "Simulated test output:\n# pass 42\n# todo 3"
			}
			if (testOutput instanceof Error) throw testOutput
		} catch {
			testOutput = "Simulated test output:\n# pass 42\n# todo 3"
		}
		this.ui.console.info(`${YELLOW}=== Simulated pnpm test:all output ===${RESET}`)
		this.ui.console.info(testOutput)

		const fail = (testOutput.match(/# fail (\d+)/) || [])[1] || 0
		const passed = (testOutput.match(/# pass (\d+)/) || [])[1] || 0
		this.ui.console.info(`${GREEN}Tests: ${passed} passed, ${fail} failed${RESET}`)
	}

	/**
	 * Locate the N-th user message and delegate to the simulation runner.
	 */
	async simulateStep(chat) {
		let targetIdx = -1
		let count = 0
		for (let i = 0; i < chat.messages.length; i++) {
			if (chat.messages[i]?.role === "user") {
				count++
				if (count === this.options.step) {
					targetIdx = i
					break
				}
			}
		}
		if (targetIdx === -1) {
			throw new Error(`Invalid step ${this.options.step}`)
		}
		return this.#runSimulation(chat, targetIdx)
	}

	/**
	 * Internal helper that actually runs the AI simulation for the message at `msgIdx`.
	 */
	async #runSimulation(chat, msgIdx) {
		const prefixMessages = chat.messages.slice(0, msgIdx)
		const userMessage = chat.messages[msgIdx]

		const packed = await packPrompt(packMarkdown, userMessage.content, chat, this.ui)
		prefixMessages.push({ role: "user", content: packed.packedPrompt })

		const ai = new TestAI()
		const simResult = await ai.streamText("test-model", prefixMessages, {
			cwd: this.chatDir,
			step: this.options.step,
			delay: this.options.delay,
		})

		await Array.fromAsync(simResult.textStream)

		const fullResponse = simResult.fullResponse
		const parsed = await Markdown.parse(fullResponse)

		return { fullResponse, parsed, simResult }
	}
}
