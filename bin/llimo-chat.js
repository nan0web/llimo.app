#!/usr/bin/env node
import process from "node:process"
import { Git, FileSystem } from "../src/utils/index.js"
import {
	GREEN, RESET, YELLOW, parseArgv, Ui
} from "../src/cli/index.js"
import {
	AI, TestAI, Chat, ModelInfo, packMarkdown,
	initialiseChat, copyInputToChat, packPrompt,
	selectModel, handleTestMode, sendAndStream, postStreamProcess
} from "../src/llm/index.js"
import { loadModels, ChatOptions } from "../src/Chat/index.js"

const PROGRESS_FPS = 30
const MAX_ERRORS = 9
// const DEFAULT_MODEL = "gpt-oss-120b"
// const DEFAULT_MODEL = "zai-glm-4.6"
// const DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"
// const DEFAULT_MODEL = "qwen-3-32b"
// const DEFAULT_MODEL = "x-ai/grok-code-fast-1"
// const DEFAULT_MODEL = "x-ai/grok-4-fast"
const DEFAULT_MODEL = process.env.LLIMO_MODEL || "gpt-oss-120b"

/**
 * Main chat loop
 * @param {string[]} [argv]
 */
async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const git = new Git({ dry: true })
	const ui = new Ui({ debugMode: argv.includes("--debug") })
	ui.console.info(RESET)

	// Parse arguments
	const command = parseArgv(argv, ChatOptions)
	const { argv: cleanArgv, isNew, isYes, testMode, testDir, model: modelStr, provider: providerStr } = command

	const format = new Intl.NumberFormat("en-US").format
	const pricing = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format
	const valuta = new Intl.NumberFormat("en-US", { currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6 }).format

	/** @type {AI} */
	let ai
	if (testMode || testDir) {
		ui.console.info(`${GREEN}🧪 Test mode enabled with chat directory: ${testDir}${RESET}`)
		ai = new TestAI()
	} else {
		const models = await loadModels(ui)
		ai = new AI({ models })

		/** @type {ModelInfo} */
		let model
		if (modelStr || providerStr) {
			model = await selectModel(models, modelStr, providerStr, ui, fs)
		} else {
			model = ai.findModel(DEFAULT_MODEL)
			if (!model) {
				const modelsList = ai.findModels(DEFAULT_MODEL)
				ui.console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
				if (modelsList.length) {
					ui.console.info("Similar models, specify the model")
					modelsList.forEach(m => ui.console.info(`- ${m.id}`))
				}
				process.exit(1)
			}
		}

		const inputPer1MT = parseFloat(model.pricing?.prompt || "0") * 1e6
		const outputPer1MT = parseFloat(model.pricing?.completion || "0") * 1e6
		const cachePer1MT = parseFloat(model.pricing?.input_cache_read || "0") + parseFloat(model.pricing?.input_cache_write || "0")

		ui.console.info(`> ${model.id} selected with modality ${model.architecture?.modality ?? "?"}`)
		ui.console.info(`  pricing: → ${pricing(inputPer1MT)} ← ${pricing(outputPer1MT)} (cache: ${pricing(cachePer1MT)})`)
		ui.console.info(`  provider: ${model.provider}`)

		// Validate API key before proceeding
		try {
			ai.getProvider(model.provider)
		} catch (err) {
			ui.console.error(err.message)
			if (err.stack) ui.console.debug(err.stack)
			process.exit(1)
		}

		// Assign for later use
		ai.selectedModel = model
	}

	// 1. read input (stdin / file) - use cleanArgv to avoid flags
	let input = ""
	let inputFile = null
	if (cleanArgv.length > 0) {
		inputFile = fs.path.resolve(cleanArgv[0])
		try {
			input = await fs.readFile(inputFile, "utf-8")
		} catch (err) {
			if (err.code === "ENOENT") {
				ui.console.error(`❌ Input file not found: ${inputFile}`)
				process.exit(1)
			}
			throw err
		}
	} else if (!process.stdin.isTTY) {
		// piped stdin
		for await (const chunk of process.stdin) input += chunk
	} else {
		// No input provided - in test mode, load from prompt.md if exists, else error
		if (testMode || testDir) {
			const testFs = new FileSystem({ cwd: testDir })
			try {
				input = await testFs.load("prompt.md") || ""
				ui.console.info(`${YELLOW}⚠️ No input provided in test mode; using prompt.md from ${testDir} (or empty)${RESET}`)
				if (!input) input = "Simulated test prompt"  // Default for empty test
			} catch {
				ui.console.error(`❌ No input provided and no prompt.md in test dir: ${testDir}`)
				process.exit(1)
			}
		} else {
			throw new Error("❌ No input provided. Pipe to stdin, provide a file, or use --test-dir with prompt.md.")
		}
	}

	// 2. initialise / load chat
	const { chat } = await initialiseChat({ ui, ChatClass: Chat, fs, isNew })
	const testChatDir = testDir || chat.dir  // Use provided dir or current chat.dir

	if (testMode || testDir) {
		const dummyModel = { pricing: { prompt: 0, completion: 0 }, architecture: { modality: "text" } }
		await handleTestMode({
			ai, ui, cwd: testChatDir, input, chat, model: dummyModel, fps: PROGRESS_FPS
		})
		return // Exits in function
	}

	// Normal real AI mode continues...
	const model = ai.selectedModel || ai.findModel(DEFAULT_MODEL)

	// 3. copy source file to chat directory (if any)
	await copyInputToChat(inputFile, input, chat, ui)

	// 4. pack prompt – prepend system.md if present
	const packed = await packPrompt(packMarkdown, input, chat, ui)
	let prompt = packed.packedPrompt

	// 5. chat loop – refactored
	let step = 1
	let consecutiveErrors = 0

	const DONE_BRANCH = ""
	const FAIL_BRANCH = ""

	while (true) {
		ui.console.info(`\nstep ${step}. ${new Date().toISOString()}`)

		ui.console.info(`\nsending (streaming) [${model.id}](@${model.provider})`)

		// Show batch discount information
		if (model.cachePrice && model.cachePrice < model.inputPrice) {
			const discount = Math.round((1 - model.cachePrice / model.inputPrice) * 100)
			ui.console.info(`\n! batch processing has ${discount}% discount compared to streaming\n`)
		}

		const streamResult = await sendAndStream({
			ai, chat, ui, step, prompt, format, valuta, model, fps: PROGRESS_FPS
		})

		const postResult = await postStreamProcess({
			...streamResult,
			ai, chat, ui, step, isYes, MAX_ERRORS
		})
		const { shouldContinue, testsCode } = postResult

		if (!shouldContinue) {
			break
		}

		const inputPrompt = await chat.db.load("prompt.md")
		await packPrompt(packMarkdown, inputPrompt || input, chat, ui)

		// 7. check if tests passed – same logic as original script
		if (true === testsCode) {
			// Task is complete, let's commit and exit
			ui.console.info(`  ${GREEN}+ Task is complete${RESET}`)
			if (DONE_BRANCH) {
				await git.renameBranch(DONE_BRANCH)
				await git.push(DONE_BRANCH)
			}
			break
		}
		else {
			consecutiveErrors++
			if (consecutiveErrors >= MAX_ERRORS) {
				ui.console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
				if (FAIL_BRANCH) {
					await git.renameBranch(FAIL_BRANCH)
				}
				break
			}
		}

		// 8. commit step and continue
		// console
		// await git.commitAll(`step ${step}: response and test results`)
		step++
	}
}

/* -------------------------------------------------------------------------- */

main().catch((err) => {
	console.error("❌ Fatal error in llimo‑chat:", err.message)
	if (err.stack && process.argv.includes("--debug")) console.error(err.stack)
	process.exit(1)
})
