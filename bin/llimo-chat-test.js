#!/usr/bin/env node
import process from "node:process"
import path from "node:path"

import { parseArgv } from "../src/cli/argvHelper.js"
import TestOptions from "../src/Test/Options.js"

import Chat from "../src/llm/Chat.js"
import TestAI from "../src/llm/TestAI.js"
import { packMarkdown } from "../src/llm/pack.js"
import { packPrompt } from "../src/llm/chatSteps.js"
import { unpackAnswer } from "../src/llm/unpack.js"
import Ui from "../src/cli/Ui.js"
import FileSystem from "../src/utils/FileSystem.js"
import MarkdownProtocol from "../src/utils/Markdown.js"

import { GREEN, RESET, YELLOW } from "../src/cli/ANSI.js"

class TestRunner {
	/** @type {string} */
	chatDir
	/** @type {TestOptions} */
	options
	/** @type {Ui} */
	ui
	/** @type {FileSystem} */
	fs

	/**
	 * @param {string} chatDir
	 * @param {TestOptions} options
	 */
	constructor(chatDir, options) {
		this.chatDir = path.resolve(chatDir)
		this.options = options
		this.ui = new Ui()
		this.fs = new FileSystem({ cwd: this.chatDir })
	}

	async run() {
		const chat = new Chat({ dir: this.chatDir })
		await chat.load()

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
	}

	async showInfo(chat) {
		this.ui.console.info(`Chat info for ${this.chatDir}`)
		this.ui.console.info(`Total messages: ${chat.messages.length}`)

		let totalTokens = 0
		const userSteps = []
		for (let i = 0; i < chat.messages.length; i += 2) { // Assuming even: system/user, odd: assistant
			const msg = chat.messages[i + 1] // User messages start at index 1,3,...
			if (msg && msg.role === "user") {
				const tokens = Math.round(msg.content.length / 4)
				totalTokens += tokens
				userSteps.push({ step: (i + 1) / 2, tokens })
				this.ui.console.info(`${(i + 1) / 2}. User: ${tokens} tokens (cumulative: ${totalTokens})`)
			}
		}

		this.ui.console.info(`Total estimated tokens: ${totalTokens}`)

		// List available step files
		const stepFiles = (await this.fs.readdir(this.chatDir)).filter(f => f.startsWith('step') && f.endsWith('.json'))
		this.ui.console.info(`Available step data: ${stepFiles.join(', ') || 'none'}`)

		if (this.options.step > 0) {
			const stepInfo = userSteps.find(s => s.step === this.options.step)
			if (stepInfo) {
				this.ui.console.info(`Step ${this.options.step}: ${stepInfo.tokens} tokens`)
			} else {
				this.ui.console.warn(`Step ${this.options.step} exceeds history (${userSteps.length} user messages)`)
			}
		}
	}

	async simulateUnpack(chat) {
		const { fullResponse, parsed } = await this.simulateStep(chat)
		this.ui.console.info(`${GREEN}Simulating unpack for step ${this.options.step}${RESET}`)

		const outputDir = this.options.outputDir || path.join(this.chatDir, `unpack-step${this.options.step}`)
		await this.fs.mkdir(outputDir, { recursive: true })

		const stream = unpackAnswer(parsed, false, outputDir)
		for await (const line of stream) {
			this.ui.console.info(line)
		}

		this.ui.console.info(`${GREEN}✅ Unpack simulation complete, files in ${outputDir}${RESET}`)
	}

	async simulateTest(chat) {
		await this.simulateUnpack(chat) // Unpack first
		this.ui.console.info(`${GREEN}Simulating tests for step ${this.options.step}${RESET}`)

		// Load saved test output
		const testFile = `test-step${this.options.step}.txt`
		let testOutput = ""
		try {
			testOutput = await this.fs.load(testFile) || "No test output saved for this step"
		} catch {
			testOutput = "Simulated test output:\n# pass 42\n# todo 3"
		}

		// "Run" by printing
		this.ui.console.info(`${YELLOW}=== Simulated pnpm test:all output ===${RESET}`)
		this.ui.console.info(testOutput)

		// Parse summary as in decodeAnswerAndRunTests
		const fail = (testOutput.match(/# fail (\d+)/) || [])[1] || 0
		const passed = (testOutput.match(/# pass (\d+)/) || [])[1] || 0
		this.ui.console.info(`${GREEN}Tests: ${passed} passed, ${fail} failed${RESET}`)
	}

	async simulateStep(chat) {
		const userIndex = 2 * this.options.step - 1 // User messages at odd indices (0: system, 1: user1, 2: assistant1, etc.)
		if (userIndex >= chat.messages.length || chat.messages[userIndex]?.role !== "user") {
			throw new Error(`Invalid step ${this.options.step}: no user message at position ${userIndex + 1}`)
		}

		const prefixMessages = chat.messages.slice(0, userIndex)
		const userMessage = chat.messages[userIndex]

		// Pack prompt (reuse packPrompt, mock ui/fs)
		const mockUi = { console: this.ui.console } // Minimal UI
		const mockChat = { ...chat, messages: prefixMessages, savePrompt: async (p) => p, db: chat.db }
		const packed = await packPrompt(packMarkdown, userMessage.content, mockChat, mockUi)
		prefixMessages.push({ role: "user", content: packed.packedPrompt })

		const ai = new TestAI()
		const simResult = await ai.streamText("test-model", prefixMessages, {
			cwd: this.chatDir,
			step: this.options.step,
			delay: this.options.delay
		})

		await Array.fromAsync(simResult.textStream) // Run simulation

		const fullResponse = simResult.fullResponse
		const parsed = await MarkdownProtocol.parse(fullResponse)

		return { fullResponse, parsed, simResult }
	}
}

/**
 * Main entry
 * @param {string[]} [argv]
 */
async function main(argv = process.argv.slice(2)) {
	const command = parseArgv(argv, TestOptions)
	const { argv: cleanArgv, mode, step, outputDir, delay } = command

	if (cleanArgv.length < 1) {
		console.error("Usage: llimo-chat-test <chat-dir> [mode] [--step N] [--dir /path] [--delay ms]")
		console.error("Modes: info (default), unpack, test")
		process.exit(1)
	}

	const chatDir = cleanArgv[0]
	const options = { mode, step, outputDir, delay }

	const runner = new TestRunner(chatDir, options)
	await runner.run()
}

main().catch(err => {
	console.error("Error:", err.message)
	process.exit(1)
})
