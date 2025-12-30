```bash
diff --git a/bin/llimo-chat.js b/bin/llimo-chat.js
index 2df26f7..72c5e7c 100755
--- a/bin/llimo-chat.js
+++ b/bin/llimo-chat.js
@@ -10,6 +10,8 @@ import { Git, FileSystem } from "../src/utils/index.js"
 import { RESET, parseArgv, Ui, ChatCLiApp } from "../src/cli/index.js"
 import { ChatOptions } from "../src/Chat/index.js"
 
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
+
 /**
  * Main chat loop
  * @param {string[]} [argv]
@@ -17,7 +19,6 @@ import { ChatOptions } from "../src/Chat/index.js"
 async function main(argv = process.argv.slice(2)) {
 	const fs = new FileSystem()
 	const git = new Git({ dry: true })
-	const ui = new Ui({ debugMode: argv.includes("--debug") })
 	ui.console.info(RESET)
 
 	// Parse arguments
@@ -73,8 +74,7 @@ Examples:
 /* -------------------------------------------------------------------------- */
 
 main().catch((err) => {
-	console.error("❌ Fatal error in llimo‑chat:", err.message)
-	if (err.stack && process.argv.includes("--debug")) console.error(err.stack)
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
-
diff --git a/bin/llimo-models.js b/bin/llimo-models.js
index 28627d2..482894e 100644
--- a/bin/llimo-models.js
+++ b/bin/llimo-models.js
@@ -4,27 +4,29 @@ import { autocompleteModels } from "../src/cli/autocomplete.js"
 import { loadModels } from "../src/Chat/models.js"
 import { parseArgv, Ui } from "../src/cli/index.js"
 import ModelsOptions from "../src/cli/ModelsOptions.js"
+import { renderHelp } from "../src/cli/argvHelper.js"
 
-const debugMode = process.argv.includes("--debug")
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
 
 /**
  * CLI entry for model browser
  */
 async function main(argv = process.argv.slice(2)) {
-	const ui = new Ui({ debugMode })
-	const modelMap = await loadModels(ui, { noCache: true })
-
 	const options = parseArgv(argv, ModelsOptions)
 
+	if (options.help) {
+		ui.console.info(renderHelp(ModelsOptions))
+		process.exit(0)
+	}
+
+	const modelMap = await loadModels(ui, { noCache: true })
 	// Filter handling – apply and exit if filter provided
 	if (options.filter) {
 		const predicates = options.getFilters()
 		const filtered = new Map()
 		for (const [id, model] of modelMap.entries()) {
 			if (predicates.every((fn) => fn(model))) {
-				const arr = filtered.get(id) ?? []
-				arr.push(model)
-				filtered.set(id, arr)
+				filtered.set(id, model)
 			}
 		}
 		const rows = autocompleteModels.modelRows(filtered)
@@ -39,12 +41,13 @@ async function main(argv = process.argv.slice(2)) {
 		autocompleteModels.pipeOutput(allModels, ui)
 	} else {
 		// Interactive mode
-		console.info("Loading models... (press /help for usage)\n")
+		ui.console.info("Loading models... (press /help for usage)\n")
 		await autocompleteModels.interactive(modelMap, ui)
 	}
 }
 
 main().catch((err) => {
-	console.error(debugMode ? err.stack ?? err.message : err.message)
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
diff --git a/bin/llimo-pack.js b/bin/llimo-pack.js
index 8d10d7d..545b943 100755
--- a/bin/llimo-pack.js
+++ b/bin/llimo-pack.js
@@ -1,6 +1,11 @@
 #!/usr/bin/env node
 import { main } from "../src/llm/pack.js"
-main().catch(err => {
-	console.error("❌ Fatal error in llimo-pack:", err)
+import { Ui } from "../src/cli/index.js"
+
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
+
+main().catch((err) => {
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
diff --git a/bin/llimo-release.js b/bin/llimo-release.js
index 98ce029..f0990b0 100644
--- a/bin/llimo-release.js
+++ b/bin/llimo-release.js
@@ -12,8 +12,10 @@ import process from "node:process"
 import path from "node:path"
 import { spawn } from "node:child_process"
 import { promisify } from "node:util"
-import { mkdir, readdir, readFile, access } from "node:fs/promises"
-import { tmpdir } from "node:os"
+import { readdir } from "node:fs/promises"
+import { Ui } from "../src/cli/index.js"
+
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
 
 const spawnAsync = promisify(spawn)
 
@@ -26,8 +28,8 @@ class ParallelRunner {
 
 		// Log
 		settled.forEach((result, i) => {
-			if (result.status === "fulfilled") console.info(`DONE: ${indepTasks[i].name}`)
-			else console.error(`FAIL: ${indepTasks[i].name} - ${result.reason}`)
+			if (result.status === "fulfilled") ui.console.info(`DONE: ${indepTasks[i].name}`)
+			else ui.console.error(`FAIL: ${indepTasks[i].name} - ${result.reason}`)
 		})
 
 		return settled
@@ -35,7 +37,7 @@ class ParallelRunner {
 
 	static async execTask(task, { docker = false }) {
 		const taskDir = path.resolve("releases/1/v1.1.0", task.dir)
-		console.info(`Running: ${task.name} (${docker ? "in Docker" : "native"})`)
+		ui.console.info(`Running: ${task.name} (${docker ? "in Docker" : "native"})`)
 
 		if (docker) {
 			return this.runInDocker(taskDir)
@@ -71,7 +73,7 @@ async function loadTasks(releaseVer) {
 /** Main CLI. */
 async function main(argv = process.argv.slice(2)) {
 	if (argv.length < 1) {
-		console.error("Usage: llmo release <v1.1.0> [--docker] [--threads 4]")
+		ui.console.error("Usage: llmo release <v1.1.0> [--docker] [--threads 4]")
 		process.exit(1)
 	}
 
@@ -80,18 +82,19 @@ async function main(argv = process.argv.slice(2)) {
 	const threads = parseInt(argv.find(a => a.startsWith("--threads="))?.split("=")[1]) || 4
 
 	const tasks = await loadTasks(releaseVer)
-	console.info(`Running ${tasks.length} tasks in ${releaseVer} (${docker ? "Docker-isolated" : "native"}, ${threads} threads)`)
+	ui.console.info(`Running ${tasks.length} tasks in ${releaseVer} (${docker ? "Docker-isolated" : "native"}, ${threads} threads)`)
 
 	const results = await ParallelRunner.run(tasks, { threads, docker })
 
 	const passed = results.filter(r => r.status === "fulfilled").length
-	console.info(`\nComplete: ${passed}/${tasks.length} passed. Run index.test.js to verify.`)
+	ui.console.info(`\nComplete: ${passed}/${tasks.length} passed. Run index.test.js to verify.`)
 	if (passed === tasks.length) {
-		console.info("All passed! Suggest: git tag v${releaseVer} && pnpm publish")
+		ui.console.info("All passed! Suggest: git tag v${releaseVer} && pnpm publish")
 	}
 }
 
-main().catch(err => {
-	console.error("Release execution failed:", err)
+main().catch((err) => {
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
diff --git a/bin/llimo-system.js b/bin/llimo-system.js
index 636e89a..e6573a0 100755
--- a/bin/llimo-system.js
+++ b/bin/llimo-system.js
@@ -10,9 +10,11 @@
 
 import process from "node:process"
 import { generateSystemPrompt } from "../src/llm/system.js"
-import { GREEN, RESET, ITALIC } from "../utils/ANSI.js"
+import { GREEN, RESET, ITALIC, Ui } from "../src/cli/index.js"
 import { FileSystem } from "../src/utils/index.js"
 
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
+
 /**
  * Main entry point.
  */
@@ -29,18 +31,20 @@ async function main(argv = process.argv.slice(2)) {
 		if (outputPath) {
 			const stats = await fs.stat(outputPath)
 			const format = new Intl.NumberFormat("en-US").format
-			console.info(` ${GREEN}+${RESET} File has been saved (${ITALIC}${format(stats.size)} bytes${RESET})`)
-			console.info(` ${GREEN}+ ${outputPath}${RESET}`)
+			ui.console.info(` ${GREEN}+${RESET} File has been saved (${ITALIC}${format(stats.size)} bytes${RESET})`)
+			ui.console.info(` ${GREEN}+ ${outputPath}${RESET}`)
 		} else {
-			console.info(output)
+			ui.console.info(output)
 		}
 	} catch (error) {
-		console.error(`❌ Cannot generate system prompt: ${error.message}`)
+		ui.console.error(`! Cannot generate system prompt: ${error.message}`)
+		if (err.stack) ui.console.debug(err.stack)
 		process.exit(1)
 	}
 }
 
-main().catch(err => {
-	console.error("❌ Fatal error in llimo‑system:", err)
+main().catch((err) => {
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
diff --git a/bin/llimo-unpack.js b/bin/llimo-unpack.js
index 6a8c5ec..6b13955 100755
--- a/bin/llimo-unpack.js
+++ b/bin/llimo-unpack.js
@@ -11,11 +11,13 @@
 import process from "node:process"
 import { Readable } from "node:stream"
 
-import { RESET } from "../src/cli/index.js"
+import { Ui } from "../src/cli/index.js"
 import { FileSystem, Path, ReadLine } from "../src/utils/index.js"
 import Markdown from "../src/utils/Markdown.js"
 import { unpackAnswer } from "../src/llm/unpack.js"
 
+const ui = new Ui({ debugMode: process.argv.includes("--debug") })
+
 /**
  * @typedef {Object} JSONResponse
  * @property {string} filename
@@ -24,18 +26,18 @@ import { unpackAnswer } from "../src/llm/unpack.js"
  */
 
 function usage() {
-	console.info("")
-	console.info("Usage with a pipe format:")
-	console.info("  ")
-	console.info(`  echo '{"filename":"test.md","content":"# Hello"}' | llimo-unpack [output-file]`)
-	console.info("  ")
-	console.info("Usage with a file format:")
-	console.info("  ")
-	console.info("  llimo-unpack <input-file> [output-file]")
-	console.info("  ")
-	console.info("    input-file  - Path to the input file")
-	console.info("    output-file - Path to the output file prints to stdout if not defined")
-	console.info("  ")
+	ui.console.info("")
+	ui.console.info("Usage with a pipe format:")
+	ui.console.info("  ")
+	ui.console.info(`  echo '{"filename":"test.md","content":"# Hello"}' | llimo-unpack [output-file]`)
+	ui.console.info("  ")
+	ui.console.info("Usage with a file format:")
+	ui.console.info("  ")
+	ui.console.info("  llimo-unpack <input-file> [output-file]")
+	ui.console.info("  ")
+	ui.console.info("    input-file  - Path to the input file")
+	ui.console.info("    output-file - Path to the output file prints to stdout if not defined")
+	ui.console.info("  ")
 }
 
 /**
@@ -118,16 +120,17 @@ async function main(argv = process.argv.slice(2)) {
 		usage()
 		return
 	}
-	console.info(RESET)
+	ui.console.info()
 
 	const parsed = await Markdown.parseStream(mdStream)
 	const stream = unpackAnswer(parsed, isDry, baseDir)
 	for await (const str of stream) {
-		console.info(str)
+		ui.console.info(str)
 	}
 }
 
-main().catch(err => {
-	console.error("❌ Fatal error in llimo‑pack:", err)
+main().catch((err) => {
+	ui.console.error(err.message)
+	if (err.stack) ui.console.debug(err.stack)
 	process.exit(1)
 })
diff --git a/dev.md b/dev.md
index d5952e7..cd0656b 100644
--- a/dev.md
+++ b/dev.md
@@ -1,4 +0,0 @@
-Як мені підключити HuggingFace / Cerebras / GLM-4.6 або GPT-OSS або QWEN-3-235B?
-
-- [](bin/llimo-chat.js)
-- [](src/**)
diff --git a/next.md b/next.md
index 5d11d8e..9f6e5f5 100644
--- a/next.md
+++ b/next.md
@@ -225,14 +225,14 @@ Write a number of the recent chat
 ## Що робимо далі
 
 1. Давай розібʼємо всі ці задачі на самі малі кроки (елементи, компоненти), які мИ можемо покрити тестами, і прикладами у `playground`, і документацією у `README.md.js`. Ці всі задачі потрібно структурувати у блоки. 
-1. Давай створимо `releases/v1.1.0/index.test.js`, який в собі буде мати список всіх категорій і тестів для кожної задачі. `describe()` використовується для категорії, `it()` для задачі і перевірки її виконання, всі `describe.todo()` на початку і всі it мають повертати fail тестування, тому що вони не можуть бути виконані з початку запуску реліза в роботу, по мірі виконання вони мають змінювати свій результат тестування і при виконанні маємо міняти `it.todo()` на `it()`, якщо задача виконана і на `it.skip()` якщо задачу не вдалось виконати за визначену кількість ітерацій `задача → llimo → test:all → [if fail → llimo ...] → git checkout release-v1.1.0 → git merge taskID
+1. Давай створимо `releases/1/v1.1.0/index.test.js`, який в собі буде мати список всіх категорій і тестів для кожної задачі. `describe()` використовується для категорії, `it()` для задачі і перевірки її виконання, всі `describe.todo()` на початку і всі it мають повертати fail тестування, тому що вони не можуть бути виконані з початку запуску реліза в роботу, по мірі виконання вони мають змінювати свій результат тестування і при виконанні маємо міняти `it.todo()` на `it()`, якщо задача виконана і на `it.skip()` якщо задачу не вдалось виконати за визначену кількість ітерацій `задача → llimo → test:all → [if fail → llimo ...] → git checkout release-v1.1.0 → git merge taskID
 1. Кожна задача має свою гілку з taskID тільки локально (поки що).
 1. Кожен реліз має свою гілку з release-[version].
 1. При запуску релізу у роботу всі `pnpm test:all` мають бути 0% fail, 0% cancelled.
 1. Створюються гілки під кожну задачу і реліз, і послідовно переключаємось на гілку і виконуємо всі завдання у декілька ітерацій з тестуванням і merge при успішному виконанні.
 1. Максимально близько інтегруємось у `ai-sdk` і використовуємо їхні інструменти, якщо такого ще немає, дописуємо своє.
 
-Зараз підготовлюємо лише `releases/v1.1.0/**`
+Зараз підготовлюємо лише `releases/1/v1.1.0/**`
 
 
 - [](bin/**)
diff --git a/package.json b/package.json
index be2557a..55f42f5 100644
--- a/package.json
+++ b/package.json
@@ -40,7 +40,7 @@
 	},
 	"dependencies": {
 		"@ai-sdk/cerebras": "^1.0.32",
-		"@ai-sdk/huggingface": "^0.0.10",
+		"@ai-sdk/huggingface": "^1.3.2",
 		"@ai-sdk/openai": "^2.0.86",
 		"@openrouter/ai-sdk-provider": "^1.4.0",
 		"ai": "^5.0.107",
diff --git a/src/Chat/Options.js b/src/Chat/Options.js
index 2e57a5c..626cce4 100644
--- a/src/Chat/Options.js
+++ b/src/Chat/Options.js
@@ -40,6 +40,13 @@ export default class ChatOptions {
 		help: "Tiny view in one row that is useful as subtask usage",
 		default: false,
 	}
+	/** @type {boolean} */
+	isFix
+	static isFix = {
+		alias: "fix",
+		help: "Fix the current project (starts with tests)",
+		default: false
+	}
 	/** @type {string} @deprecated Moved to the command test */
 	testDir
 	static testDir = {
@@ -81,6 +88,7 @@ export default class ChatOptions {
 			isYes = ChatOptions.isYes.default,
 			isTiny = ChatOptions.isTiny.default,
 			isHelp = ChatOptions.isHelp.default,
+			isFix = ChatOptions.isFix.default,
 			isTest = ChatOptions.isTest.default,
 			testDir = ChatOptions.testDir.default,
 			model = ChatOptions.model.default,
@@ -94,6 +102,7 @@ export default class ChatOptions {
 		this.isYes = Boolean(isYes)
 		this.isTiny = Boolean(isTiny)
 		this.isHelp = Boolean(isHelp)
+		this.isFix = Boolean(isFix)
 		this.isTest = Boolean(isTest)
 		this.testDir = String(testDir)
 		this.model = model
diff --git a/src/Chat/commands/test.js b/src/Chat/commands/test.js
index 3da5451..d38e3b7 100644
--- a/src/Chat/commands/test.js
+++ b/src/Chat/commands/test.js
@@ -5,7 +5,7 @@ import { InfoCommand } from "./info.js"
 import FileSystem from "../../utils/FileSystem.js"
 import { Progress, Alert } from "../../cli/components/index.js"
 import { parseOutput } from "../../cli/testing/node.js"
-import { GREEN, RED, RESET, YELLOW } from "../../cli/ANSI.js"
+import { testingProgress } from "../../cli/testing/progress.js"
 
 /**
  * @param {string} str
@@ -142,15 +142,7 @@ export class TestCommand extends InfoCommand {
 		yield warn(`+ Install complete: success`)
 
 		// Step 4: Run tests before chatting
-		const testing = this.ui.createProgress((input) => {
-			const parsed = parseOutput(output.join("\n"), "", this.fs)
-			const str = [
-				["tests"], ["pass", GREEN], ["fail", RED], ["cancelled", RED], ["types", RED],
-				["skip", YELLOW], ["todo", YELLOW]
-			].map(([f, color = RESET]) => `${color}${f}: ${parsed.counts[f] || parsed.guess[f]}${RESET}`).join(" | ")
-
-			this.ui.overwriteLine(`  ${input.elapsed.toFixed(2)}s ${str}`)
-		})
+		const testing = testingProgress({ ui: this.ui, fs: this.fs, output, rows: 3 })
 		yield warn(`  Running baseline tests in ${testDir}...`)
 		const { exitCode: testExitCode, stdout: testOut, stderr: testErr } = await runCommand(
 			"pnpm", ["test:all"], { cwd: testDir, onData }
@@ -159,7 +151,7 @@ export class TestCommand extends InfoCommand {
 		yield Alert.info("")
 		const parsed = parseOutput(testOut, testErr, this.fs)
 		const ok = testExitCode === 0
-		const failed = parsed.counts.fail + parsed.counts.cancelled + parsed.counts.types + parsed.counts.types
+		const failed = parsed.counts.fail + parsed.counts.cancelled + parsed.counts.types
 		yield warn(`${ok ? "+" : "-"} Baseline tests complete: ${ok ? "all passed" : `${failed} failed`}`)
 		if (failed > 0) {
 			if (parsed.counts.fail + parsed.counts.cancelled > 0) {
diff --git a/src/cli/App.js b/src/cli/App.js
index 7812958..5c6c82f 100644
--- a/src/cli/App.js
+++ b/src/cli/App.js
@@ -4,7 +4,7 @@ import { GREEN, RESET, MAGENTA, ITALIC, BOLD, YELLOW, RED } from "./ANSI.js"
 import { Ui } from "./Ui.js"
 import UiOutput from "./UiOutput.js"
 import { runCommand } from "./runCommand.js"
-import { selectAndShowModel } from "./selectModel.js"
+import { selectAndShowModel, showModel } from "./selectModel.js"
 import {
 	AI, TestAI, Chat, packMarkdown,
 	initialiseChat, copyInputToChat, packPrompt,
@@ -13,7 +13,6 @@ import {
 	ModelInfo, Architecture, Pricing,
 	decodeAnswer,
 	decodeAnswerAndRunTests,
-	ModelProvider,
 	Usage,
 } from "../llm/index.js"
 import { loadModels, ChatOptions } from "../Chat/index.js"
@@ -215,12 +214,20 @@ export class ChatCLiApp {
 			step,
 			messages: []
 		})
-		this.ui.console.info(`\n@ step ${step}. ${new Date().toLocaleString()}`)
+		this.ui.console.info(`\n@ Step ${step}. ${new Date().toLocaleString()}`)
 
 		const promptFiles = 0
 		const all = this.chat.messages.map(m => JSON.stringify(m)).join("\n\n")
 		const totalSize = prompt.length + all.length
 		const totalTokens = await this.chat.calcTokens(prompt + all)
+
+		const found = this.ai.ensureModel(model, totalTokens)
+		if (found && found.id !== model.id) {
+			this.ui.console.info(`@ Model changed due to ${this.ai.strategy.constructor.name}`)
+			showModel(found, this.ui)
+			model = found
+		}
+
 		const cost = await this.chat.cost()
 		const left = model.context_length - totalTokens
 		const str = [
@@ -244,6 +251,7 @@ export class ChatCLiApp {
 		}
 		if (!this.options.isYes) {
 			const ans = await this.ui.askYesNo(`\n${MAGENTA}? Send prompt to LLiMo? (Y)es, No: ${RESET}`)
+			this.ui.console.info("")
 			if ("yes" !== ans) return false
 		}
 		return true
@@ -259,9 +267,15 @@ export class ChatCLiApp {
 		await this.chat.save()
 		this.ui.console.info("")
 		if (sent.reason) {
-			this.ui.console.info(`+ reason (${this.chat.path("reason.md", step)})`)
+			let reasonFile = this.chat.path("reason.md", step)
+			let rel = this.chat.fs.path.relative(this.chat.fs.cwd, reasonFile)
+			if (rel.startsWith("..")) rel = reasonFile
+			this.ui.console.info(`+ reason (${rel})`)
 		}
-		this.ui.console.info(`+ answer (${this.chat.path("answer.md", step)})`)
+		let answerFile = this.chat.path("answer.md", step)
+		let rel = this.chat.fs.path.relative(this.chat.fs.cwd, answerFile)
+		if (rel.startsWith("..")) rel = answerFile
+		this.ui.console.info(`+ answer (${rel})`)
 		return await decodeAnswer({ ui: this.ui, chat: this.chat, options: this.options })
 	}
 	/**
@@ -277,9 +291,6 @@ export class ChatCLiApp {
 			ai: this.ai, chat: this.chat, ui: this.ui, step, prompt,
 			format: this.#format, valuta: this.#valuta, model
 		})
-		if (streamed.reason) {
-			this.ui.console.info(`+ reason (${this.chat.path("reason.md", step)})`)
-		}
 		// Save step info including model
 		this.#steps.push({ step, model, prompt })
 		await this.chat.save("steps.jsonl", this.#steps)
@@ -288,18 +299,18 @@ export class ChatCLiApp {
 	/**
 	 *
 	 * @param {number} [step=1]
-	 * @returns {Promise<{ shouldContinue: boolean, test: import("../llm/chatSteps.js").TestOutput }>}
+	 * @returns {Promise<{ shouldContinue: boolean, test?: import("../cli/testing/node.js").TestOutput }>}
 	 */
 	async test(step = 1) {
 		// @todo use the small progress window
-		const onData = (d) => this.ui.write(String(d))
-		const tested = await decodeAnswerAndRunTests(
-			this.ui,
-			this.chat,
-			async (cmd, args, opts = {}) => runCommand(cmd, args, { ...opts, onData }),
-			this.options,
+		const tested = await decodeAnswerAndRunTests({
+			ui: this.ui,
+			fs: this.fs,
+			chat: this.chat,
+			runCommand,
+			options: this.options,
 			step
-		)
+		})
 		const { test } = tested
 		if (true === tested.testsCode) {
 			// Task is complete, let's commit and exit
@@ -384,11 +395,13 @@ export class ChatCLiApp {
 		// 3. copy source file to chat directory (if any)
 		let { step, prompt, model, packed } = await this.start()
 		while (true) {
-			let shouldContinue = await this.prepare(prompt, model, packed, step)
-			if (!shouldContinue) break
-			const sent = await this.send(prompt, model, step)
-			const unpacked = await this.unpack(sent, step)
-			if (!unpacked.shouldContinue) break
+			if (!this.options.isFix) {
+				let shouldContinue = await this.prepare(prompt, model, packed, step)
+				if (!shouldContinue) break
+				const sent = await this.send(prompt, model, step)
+				const unpacked = await this.unpack(sent, step)
+				if (!unpacked.shouldContinue) break
+			}
 			const tested = await this.test(step)
 			if (!tested.shouldContinue) break
 			await this.next(tested.test, step)
diff --git a/src/cli/ModelsOptions.js b/src/cli/ModelsOptions.js
index da4f290..cd4ee2d 100644
--- a/src/cli/ModelsOptions.js
+++ b/src/cli/ModelsOptions.js
@@ -21,15 +21,25 @@ export class ModelsOptions {
 		].join("\n"),
 		default: "",
 	}
+	help
+	static help = {
+		alias: "h",
+		help: "Show help",
+		default: false,
+	}
 	constructor(input = {}) {
-		const { filter = ModelsOptions.filter.default } = input
+		const {
+			filter = ModelsOptions.filter.default,
+			help = ModelsOptions.help.default,
+		} = input
 		this.filter = String(filter)
+		this.help = Boolean(help)
 	}
 	/**
 	 * @returns {Array<(model: ModelInfo) => boolean>}
 	 */
 	getFilters() {
-		const regExp = /([^~><=]+)([~><=]{1})(.+)/i
+		const regExp = /(id|provider|context|price)([~><=]{1})(.+)/i
 		const available = new Map([
 			["id", ["=", "~"]],
 			["provider", ["=", "~"]],
@@ -56,9 +66,9 @@ export class ModelsOptions {
 				const valStr = rawValue.trim().toLowerCase()
 				let numVal
 				if (/^\d+[kK]$/.test(valStr)) {
-					numVal = Math.round(Number(valStr.slice(0, -1)) * 1000)
+					numVal = Math.round(Number(valStr.slice(0, -1)) * 1e3)
 				} else if (/^\d+[mM]$/.test(valStr)) {
-					numVal = Math.round(Number(valStr.slice(0, -1)) * 1000000)
+					numVal = Math.round(Number(valStr.slice(0, -1)) * 1e6)
 				} else {
 					numVal = Number(valStr)
 				}
diff --git a/src/cli/Ui.js b/src/cli/Ui.js
index 6c23c6b..9363173 100644
--- a/src/cli/Ui.js
+++ b/src/cli/Ui.js
@@ -7,7 +7,21 @@ import { YELLOW, RED, RESET, GREEN, overwriteLine, cursorUp, DIM, stripANSI, ITA
 import Alert from "./components/Alert.js"
 import Table from "./components/Table.js"
 
-/** @typedef {"success" | "info" | "warn" | "error" | "debug"} LogTarget */
+/** @typedef {"success" | "info" | "warn" | "error" | "debug" | "log"} LogTarget */
+
+export class UiStyle {
+	/** @type {number} */
+	paddingLeft
+	/**
+	 * @param {Partial<UiStyle>} input
+	 */
+	constructor(input = {}) {
+		const {
+			paddingLeft = 0,
+		} = input
+		this.paddingLeft = Number(paddingLeft)
+	}
+}
 
 export class UiFormats {
 	/**
@@ -149,6 +163,42 @@ export class UiConsole {
 		this.prefixedStyle = prefix
 	}
 
+	/**
+	 * @todo write jsdoc
+	 * @param {any[]} args
+	 * @returns {{ styles: UiStyle[], args: any[] }}
+	 */
+	extractStyles(args = []) {
+		const styles = []
+		let rest = []
+		args.forEach(el => {
+			if (el instanceof UiStyle) {
+				styles.push(el)
+			} else {
+				rest.push(el)
+			}
+		})
+		let combined = {}
+		styles.forEach(s => combined = { ...combined, ...s })
+		Object.entries(new UiStyle(combined)).forEach(([name, value]) => {
+			if ("paddingLeft" === name) {
+				const spaces = " ".repeat(Number(value))
+				rest = rest.map(s => String(s).split("\n").map(l => `${spaces}${l}`).join("\n"))
+			}
+		})
+		return { styles, args: rest }
+	}
+
+	/**
+	 * @todo write jsdoc
+	 * @param {any[]} args
+	 * @returns {string}
+	 */
+	extractMessage(args = []) {
+		const { args: words } = this.extractStyles(args)
+		return words.join(" ")
+	}
+
 	/**
 	 * Output a debug message when debug mode is enabled.
 	 *
@@ -156,42 +206,42 @@ export class UiConsole {
 	 */
 	debug(...args) {
 		if (!this.debugMode) return
-		const msg = args.join(" ")
+		const msg = this.extractMessage(args)
 		this.console.debug(DIM + msg + RESET)
 		this.appendFile("debug", msg)
 	}
 
 	/** @param {...any} args */
 	info(...args) {
-		const msg = this.prefixedStyle + args.join(" ") + RESET
+		const msg = this.prefixedStyle + this.extractMessage(args) + RESET
 		this.console.info(msg)
 		this.appendFile("info", msg)
 	}
 
 	/** @param {...any} args */
 	log(...args) {
-		const msg = args.join(" ")
+		const msg = this.extractMessage(args)
 		this.console.log(msg)
 		this.appendFile("log", msg)
 	}
 
 	/** @param {...any} args */
 	warn(...args) {
-		const msg = YELLOW + args.join(" ") + RESET
+		const msg = YELLOW + this.extractMessage(args) + RESET
 		this.console.warn(msg)
 		this.appendFile("warn", msg)
 	}
 
 	/** @param {...any} args */
 	error(...args) {
-		const msg = RED + args.join(" ") + RESET
+		const msg = RED + this.extractMessage(args) + RESET
 		this.console.error(msg)
 		this.appendFile("error", msg)
 	}
 
 	/** @param {...any} args */
 	success(...args) {
-		const msg = GREEN + args.join(" ") + RESET
+		const msg = GREEN + this.extractMessage(args) + RESET
 		// Use this.console.info to match test expectations
 		this.console.info(msg)
 		this.appendFile("success", msg)
@@ -204,7 +254,7 @@ export class UiConsole {
 	 * @returns {string}
 	 */
 	full(line, space = " ") {
-		const [w, h] = this.stdout.getWindowSize()
+		const [w, h] = this.stdout.getWindowSize?.() ?? [120, 30]
 		if (line.length > w) line = line.slice(0, w - 1) + "…"
 		if (line.length < w) line += space.repeat(w - line.length)
 		return line
@@ -325,7 +375,11 @@ export class Ui {
 		this.stdin = stdin
 		this.stdout = stdout
 		this.stderr = stderr
-		this.console = console ? console : new UiConsole({ debugMode: this.debugMode, stdout: /** @type {any} */ (stdout) })
+		this.console = console instanceof UiConsole ? console
+		: new UiConsole({
+			debugMode: this.debugMode,
+			stdout: /** @type {any} */ (stdout), ...(console ?? {})
+		})
 		this.formats = formats
 	}
 
@@ -432,6 +486,16 @@ export class Ui {
 			fn({ elapsed, startTime })
 		}, 1e3 / fps)
 	}
+
+	/**
+	 * @todo write jsdoc
+	 * @param {Object} options
+	 * @param {number} [options.paddingLeft]
+	 * @returns {UiStyle}
+	 */
+	createStyle(options = {}) {
+		return new UiStyle(options)
+	}
 }
 
 export default Ui
diff --git a/src/cli/argvHelper.js b/src/cli/argvHelper.js
index b1f79c8..4922da4 100644
--- a/src/cli/argvHelper.js
+++ b/src/cli/argvHelper.js
@@ -142,3 +142,15 @@ export function parseArgv(argv, Model) {
 	}
 	return result
 }
+
+/**
+ * @param {typeof Object} Model
+ * @returns {string}
+ */
+export function renderHelp(Model) {
+	const result = []
+	for (const [name, meta] of Object.entries(Model)) {
+		result.push(`--${name} ${meta?.help ?? ""}`)
+	}
+	return result.join("\n")
+}
diff --git a/src/cli/autocomplete.full.test.js b/src/cli/autocomplete.full.test.js
index b6f61f9..9ebf39c 100644
--- a/src/cli/autocomplete.full.test.js
+++ b/src/cli/autocomplete.full.test.js
@@ -17,7 +17,7 @@ import {
 import ModelInfo from "../llm/ModelInfo.js"
 import Pricing from "../llm/Pricing.js"
 import Architecture from "../llm/Architecture.js"
-import Ui, { UiFormats } from "./Ui.js"
+import Ui, { UiConsole, UiFormats } from "./Ui.js"
 
 // -----------------------------------------------------
 // helpers
@@ -207,11 +207,9 @@ describe("autocomplete – core utilities", () => {
 
 	it("pipeOutput produces correct rows", () => {
 		const rows = modelRows(createTestModelMap())
-		const mockUi = new Ui({
-			console: {
-				table: mock.fn()
-			}
-		})
+		const console = new UiConsole()
+		console.table = mock.fn()
+		const mockUi = new Ui({ console })
 		pipeOutput(rows, mockUi)
 		const call = mockUi.console.table.mock.calls[0].arguments
 		assert.ok(Array.isArray(call[0]))
diff --git a/src/cli/autocomplete.js b/src/cli/autocomplete.js
index b850e01..1b5b8ce 100644
--- a/src/cli/autocomplete.js
+++ b/src/cli/autocomplete.js
@@ -48,7 +48,7 @@ export function model2row(info, id) {
 		|| "text"
 
 	const tools = !!(info.supports_tools ?? info.supportsTools ?? false)
-	const jsonMode = !!(info.supports_structured_output ?? info.supportsStructuredOutput ?? false)
+	const jsonMode = !!(info.supports_structured_output ?? info.supports_structured_output ?? false)
 
 	return {
 		id: info.id || id, // Use info.id instead of full key for display/search
diff --git a/src/cli/selectModel.js b/src/cli/selectModel.js
index c3f0b7d..9d98c7a 100644
--- a/src/cli/selectModel.js
+++ b/src/cli/selectModel.js
@@ -1,5 +1,30 @@
 import { selectModel } from "../llm/selectModel.js"
 
+/**
+ * @param {import("../llm/ModelInfo.js").default} model
+ * @param {import("./Ui.js").Ui} ui
+ */
+export function showModel(model, ui) {
+	// Show model & provider info
+	const inputPricePerM = model.pricing?.prompt ?? 0
+	const outputPricePerM = model.pricing?.completion ?? 0
+	const contextLen = ui.formats.weight("T", model.context_length)
+	const maxOutput = model.maximum_output > 0 ? ui.formats.weight("T", model.maximum_output) : contextLen
+
+	// Cache price only if both read/write >0
+	let cacheStr = ""
+	const cacheRead = model.pricing?.input_cache_read ?? 0
+	const cacheWrite = model.pricing?.input_cache_write ?? 0
+	if (cacheRead > 0 || cacheWrite > 0) {
+		const cachePerM = cacheRead + cacheWrite
+		cacheStr = ` (cache: ${ui.formats.pricing(cachePerM)} / 1M)`
+	}
+
+	ui.console.info(`@ ${model.id} @${model.provider} [${model.architecture?.modality ?? "?"}]`)
+	ui.console.info(`  context: ${contextLen} (max output → ${maxOutput})`)
+	ui.console.info(`  price: → ${ui.formats.money(inputPricePerM, 2)} / 1M ← ${ui.formats.money(outputPricePerM, 2)} / 1M${cacheStr}`)
+}
+
 /**
  * Pre-selects a model (loads from cache or defaults). If multiple matches,
  * shows the table and prompts. Persists selection to chat.config.model.
@@ -21,10 +46,10 @@ export async function selectAndShowModel(ai, ui, modelStr, providerStr, onSelect
 		const found = ai.findModel(DEFAULT_MODEL)
 		if (!found) {
 			const modelsList = ai.findModels(DEFAULT_MODEL)
-			ui.console.error(`❌ Model '${DEFAULT_MODEL}' not found`)
+			ui.console.error(`! Model '${DEFAULT_MODEL}' not found`)
 			if (modelsList.length) {
-				ui.console.info("Similar models, specify the model")
-				modelsList.forEach(m => ui.console.info(`- ${m.id}`))
+				ui.console.info("  Similar models, specify the model")
+				modelsList.forEach(m => ui.console.info(`  - ${m.id}`))
 			}
 			process.exit(1)
 		}
@@ -44,24 +69,7 @@ export async function selectAndShowModel(ai, ui, modelStr, providerStr, onSelect
 		process.exit(1)
 	}
 
-	// Show model & provider info
-	const inputPricePerM = model.pricing?.prompt ?? 0
-	const outputPricePerM = model.pricing?.completion ?? 0
-	const contextLen = ui.formats.weight("T", model.context_length)
-	const maxOutput = model.maximum_output > 0 ? ui.formats.weight("T", model.maximum_output) : contextLen
-
-	// Cache price only if both read/write >0
-	let cacheStr = ""
-	const cacheRead = model.pricing?.input_cache_read ?? 0
-	const cacheWrite = model.pricing?.input_cache_write ?? 0
-	if (cacheRead > 0 || cacheWrite > 0) {
-		const cachePerM = cacheRead + cacheWrite
-		cacheStr = ` (cache: ${ui.formats.pricing(cachePerM)} / 1M)`
-	}
-
-	ui.console.info(`@ ${model.id} @${model.provider} [${model.architecture?.modality ?? "?"}]`)
-	ui.console.info(`  context: ${contextLen} (max output → ${maxOutput})`)
-	ui.console.info(`  price: → ${ui.formats.money(inputPricePerM, 2)} / 1M ← ${ui.formats.money(outputPricePerM, 2)} / 1M${cacheStr}`)
+	showModel(model, ui)
 	return model
 }
 
diff --git a/src/cli/testing/node.js b/src/cli/testing/node.js
index 8bbc7e1..d4ccfaf 100644
--- a/src/cli/testing/node.js
+++ b/src/cli/testing/node.js
@@ -1,14 +1,298 @@
 import yaml from "yaml"
 import FileSystem from "../../utils/FileSystem.js"
+
+/**
+ * @typedef {Object} TapParseResult
+ * @property {string} [version]
+ * @property {TestInfo[]} tests
+ * @property {Map<number, Error>} errors
+ * @property {Map<number, string>} unknowns
+ * @property {Map<string, number>} counts
+ */
+
+/**
+ * TAP parser – extracts test‑level information from raw TAP output.
+ */
+export class Tap {
+	/** @type {string[]} */
+	rows
+	/** @type {FileSystem} */
+	fs
+	/** @type {Map<number, string>} rows that are not part of a TAP test */
+	unknowns = new Map()
+	/** @type {Map<number, Error>} parsing errors */
+	errors = new Map()
+	/** @type {Map<string, number>} count of errors by type */
+	counts = new Map()
+	/** @type {TestInfo[]} */
+	tests = []
+
+	/** @param {Partial<Tap>} input */
+	constructor(input) {
+		const {
+			rows = [],
+			fs = new FileSystem(),
+		} = input
+		this.rows = rows
+		this.fs = fs
+	}
+
+	/**
+	 * Walk through all rows and produce a high‑level summary.
+	 * @returns {TapParseResult}
+	 */
+	parse() {
+		let version
+		this.unknowns = new Map()
+		this.errors = new Map()
+		this.counts = new Map()
+		this.tests = []
+
+		const summary = [
+			"# fail ",
+			"# cancelled ",
+			"# pass ",
+			"# tests ",
+			"# suites ",
+			"# skipped ",
+			"# todo ",
+			"# duration_ms ",
+		]
+		const trans = { skipped: "skip", duration_ms: "duration" }
+		summary.forEach(sum => {
+			let name = sum.split(" ")[1]
+			name = trans[name] ?? name
+			this.counts.set(name, 0)
+		})
+
+		for (let i = 0; i < this.rows.length; i++) {
+			const row = this.rows[i]
+			const str = row.trim()
+			const found = summary.find(s => str.startsWith(s))
+			if (row.startsWith("TAP version ")) {
+				version = row.slice(12)
+			}
+			else if (str.startsWith("# Subtest: ")) {
+				i = this.collectTest({ i })
+			}
+			else if (str.match(/^\d+\.\.\d+$/)) {
+				// @todo use subtotal markers like "1..1" for validation
+			}
+			else if (found) {
+				let [, name] = found.split(" ")
+				if (trans[name]) name = trans[name]
+				const val = str.slice(found.length)
+				let value = this.counts.get(name) ?? 0
+				value += name.includes("duration") ? parseFloat(val) : parseInt(val)
+				this.counts.set(name, value)
+			}
+			else {
+				this.unknowns.set(i, row)
+			}
+		}
+		return {
+			version,
+			tests: this.tests,
+			errors: this.errors,
+			unknowns: this.unknowns,
+			counts: this.counts,
+		}
+	}
+
+	/**
+	 * Collects test information from a subtest block.
+	 *
+	 * Handles both indented YAML (`---` ...) and non‑indented variants.
+	 *
+	 * @param {{ i: number, parent?: number }} input
+	 * @returns {number} new index (position right after the processed block)
+	 */
+	collectTest(input) {
+		const { i, parent } = input
+		const row = this.rows[i]                // "# Subtest: ..."
+		const str = row.trim()
+		const text = str.slice(11)              // subtest title
+
+		let j = i + 1
+		const next = this.rows[j] ?? ""
+		const clean = next.trim()
+		const indent = next.split('').findIndex(s => s !== " ")
+
+		let value = ""
+		let fail = false
+		if (clean.startsWith("# Subtest: ")) {
+			const nextI = this.collectTest({ i: j, parent: i })
+			const x = 9
+			return nextI
+		}
+		else if (clean.startsWith("not ok ")) {
+			value = clean.slice(7)
+			fail = true
+		}
+		else if (clean.startsWith("ok ")) {
+			value = clean.slice(3)
+		}
+		else {
+			this.unknowns.set(j, next)
+			return j
+		}
+		const [no_, , ...v] = value.split(" ")
+		const no = parseInt(no_)
+		const status = v.join(" ").slice(text.length).trim()
+
+		// -----------------------------------------------------------------
+		// YAML block handling – works with or without leading indentation.
+		// -----------------------------------------------------------------
+		++j
+		const yamlLines = []
+		if (this.rows[j]?.trim() === "---") {
+			// Consume the opening delimiter.
+			j++
+			for (; j < this.rows.length; j++) {
+				const line = this.rows[j].slice(indent)
+				if (line.trim() === "...") break
+				yamlLines.push(line)
+			}
+			// Skip the closing delimiter.
+			j++
+		}
+		// -----------------------------------------------------------------
+
+		let doc = {}
+		try {
+			doc = yaml.parse(yamlLines.join("\n"))
+		} catch (/** @type {any} */ err) {
+			this.errors.set(j, err)
+			doc = {}
+		}
+		/** @type {[number, number]} */
+		let position = [0, 0]
+		let file
+		if (doc?.location) {
+			const [loc, x, y = "0"] = doc.location.split(":")
+			position = [parseInt(x), parseInt(y)]
+			file = this.fs.path.relative(this.fs.path.cwd, this.fs.path.resolve(this.fs.path.cwd, loc))
+		}
+		this.tests.push({
+			type: "# TODO" === status ? "todo"
+				: "# SKIP" === status ? "skip"
+					: "testTimeoutFailure" === doc?.failureType ? "cancelled"
+						: fail ? "fail" : "pass",
+			no,
+			text,
+			indent,
+			position,
+			doc,
+			file,
+			parent,
+		})
+		// Return index of the line just before the next iteration will increment.
+		return j - 1
+	}
+}
+
+export class DeclarationTS extends Tap {
+	/**
+	 * Walk through all rows and collect types errors.
+	 * @returns {TapParseResult}
+	 */
+	parse() {
+		this.unknowns = new Map()
+		this.errors = new Map()
+		this.counts = new Map([["types", 0]])
+		this.tests = []
+
+		for (let i = 0; i < this.rows.length; i++) {
+			const row = this.rows[i]
+			const str = row.trim()
+			const match = str.match(/^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/)
+			if (match) {
+				i = this.collectTest({ i, match })
+			}
+			else {
+				this.unknowns.set(i, row)
+			}
+		}
+		this.tests.forEach(t => {
+			const count = this.counts.get(`TS${t.no}`) ?? 0
+			this.counts.set(`TS${t.no}`, count + 1)
+		})
+		return {
+			version: "1",
+			tests: this.tests,
+			errors: this.errors,
+			unknowns: this.unknowns,
+			counts: this.counts,
+		}
+	}
+	/**
+	 *
+	 * @param {Object} input
+	 * @param {number} input.i
+	 * @param {RegExpMatchArray} input.match
+	 * @returns {number}
+	 */
+	collectTest(input) {
+		const { i, match } = input
+		// const row = this.rows[i]
+		// const str = row.trim()
+		let j = i + 1
+		const addon = []
+		for (; j < this.rows.length; j++) {
+			const row = this.rows[j]
+			if (!row.startsWith("  ")) break
+			addon.push(row)
+		}
+		this.tests.push({
+			file: match[1],
+			position: [parseInt(match[2]), parseInt(match[3])],
+			no: parseInt(match[4]),
+			text: [match[5], ...addon].join("\n"),
+			type: "types",
+			indent: 0,
+		})
+		return j - 1
+	}
+}
+
+export class Suite extends Tap {
+	/**
+	 * @returns {TapParseResult & { tap: TapParseResult, ts: TapParseResult }}
+	 */
+	parse() {
+		const tap = new Tap({ rows: this.rows, fs: this.fs })
+		const tapped = tap.parse()
+		// await fs.save("node-tap.json", tapped)
+		const ts = new DeclarationTS({ rows: Array.from(tapped.unknowns.values()), fs: this.fs })
+		const tsed = ts.parse()
+		const counts = new Map(tapped.counts)
+		counts.set("types", tsed.tests.length)
+		const errors = new Map([
+			...Array.from(tapped.errors.entries()),
+			...Array.from(tsed.errors.entries())
+		])
+		// await fs.save("node-ts.json", tsed)
+		return {
+			tap: tapped,
+			ts: tsed,
+			errors,
+			unknowns: tsed.unknowns,
+			tests: [...tapped.tests, ...tsed.tests],
+			counts,
+		}
+	}
+}
+
 /**
  * @typedef {Object} TestInfo
- * @property {string} type
+ * @property {"todo" | "fail" | "pass" | "cancelled" | "skip" | "types"} type
  * @property {number} no
  * @property {string} text
  * @property {number} indent
+ * @property {number} [parent]
  * @property {string} [file]
  * @property {object} [doc]
- * @property {[number, number] } [position]
+ * @property {[number, number]} [position]
  *
  * @typedef {Object} TestOutputLogEntry
  * @property {number} i
@@ -55,6 +339,7 @@ export function parseOutput(stdout, stderr, fs = new FileSystem()) {
 		todo: [],
 		duration: [],
 		types: [],
+		missing: [],
 	}
 	const counts = {
 		fail: 0,
@@ -93,100 +378,34 @@ export function parseOutput(stdout, stderr, fs = new FileSystem()) {
 		duration: ["# duration_ms ", "ℹ duration_ms "],
 	}
 
-	/**
-	 * @type {TestInfo[]}
-	 */
+	/** @type {TestInfo[]} */
 	const tests = []
 
-	/**
-	 * @param {boolean} fail
-	 * @param {RegExpMatchArray | null} match
-	 * @param {number} spaces
-	 * @param {number} i
-	 * @param {string} row
-	 * @returns {number}
-	 */
-	const collectTap = (fail, match, spaces, i, row) => {
-		if (!match) return i
-		const content = []
-		let shift
-		let j = i + 1
-		for (; j < all.length; j++) {
-			const s = all[j].split('').findIndex(s => s != " ")
-			if (undefined === shift) shift = s
-			if (s >= 0 && s <= spaces) break
-			content.push(all[j].slice(shift))
-		}
-		const str = content.slice(1, -1).join("\n")
-		const doc = yaml.parse(str)
-		/** @type {[number, number]} */
-		let position = [0, 0]
-		let file
-		if (doc.location) {
-			const [loc, x, y = "0"] = doc.location.split(":")
-			position = [parseInt(x), parseInt(y)]
-			file = fs.path.relative(fs.path.cwd, fs.path.resolve(fs.path.cwd, loc))
-		}
-		tests.push({
-			type: row.endsWith("# TODO") ? "todo"
-				: row.endsWith("# SKIP") ? "skip"
-					: "testTimeoutFailure" === doc?.failureType ? "cancelled"
-						: fail ? "fail" : "pass",
-			no: parseInt(match[1]),
-			text: String(match[2] || "").trim(),
-			indent: spaces,
-			position,
-			doc,
-			file,
-		})
-		return j - 1
-	}
-
-	/**
-	 * @param {RegExpMatchArray | null} match
-	 * @param {number} spaces
-	 * @param {number} i
-	 * @param {string} row
-	 * @returns {number}
-	 */
-	const collectDts = (match, spaces, i, row) => {
-		if (!match) return i
-		let j = i + 1
-		const content = []
-		for (; j < all.length; j++) {
-			const s = all[j].split('').findIndex(s => s != " ")
-			if (s >= 0 && s <= spaces) break
-			content.push(all[j])
-		}
-		tests.push({
-			type: "types",
-			file: match[1],
-			position: [parseInt(match[2]), parseInt(match[3])],
-			no: parseInt(match[4]),
-			text: [match[5], ...content].join("\n"),
-			indent: spaces,
-		})
-		return i
-	}
-
 	for (let i = 0; i < all.length; i++) {
-		const str = all[i].trim()
+		const row = all[i]
+		const str = row.trim()
 		const spaces = all[i].split('').findIndex(s => s != " ")
 		const notOk = str.match(/^not ok (\d+) - (.*)$/)
 		const ok = str.match(/^ok (\d+) - (.*)$/)
 		const dts = str.match(/^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)/)
-		if (notOk || ok) {
-			i = collectTap(Boolean(notOk), ok || notOk, spaces, i, str)
+
+		if (row.startsWith("TAP version ")) {
+			// ignored – version already processed by Tap
 		}
-		else if (dts) {
-			i = collectDts(dts, spaces, i, str)
+		else if (str.startsWith("# Subtest: ")) {
+			const tap = new Tap({ rows: all, fs })
+			i = tap.collectTest({ i })
+			tests.push(...tap.tests)
+		}
+		else if (str.match(/^\d+\.\.\d+$/)) {
+			// ignore subtotal markers
 		}
 		else {
 			for (const [name, arr] of Object.entries(parser)) {
 				if (!(name in counts)) continue
 				for (const s of arr) {
 					if (str.startsWith(s)) {
-						if ("duration" === name) {
+						if (name === "duration") {
 							counts[name] += parseFloat(str.slice(s.length))
 						} else {
 							counts[name] += parseInt(str.slice(s.length))
@@ -196,17 +415,17 @@ export function parseOutput(stdout, stderr, fs = new FileSystem()) {
 			}
 		}
 	}
-	const types =  new Set()
+
+	const types = new Set()
 	for (const test of tests) {
 		if (test.type in guess) ++guess[test.type]
-		if ("types" === test.type) {
+		if (test.type === "types") {
 			types.add(test.no)
 			counts.types++
 		}
 		guess.duration += test.doc?.duration_ms || 0
 	}
-
-	// Round duration to three decimal places for consistency
+	// deterministic rounding
 	counts.duration = Math.round(counts.duration * 1e3) / 1e3
 
 	return { counts, guess, logs, tests, types }
diff --git a/src/cli/testing/node.test.js b/src/cli/testing/node.test.js
index c251764..2b60f1a 100644
--- a/src/cli/testing/node.test.js
+++ b/src/cli/testing/node.test.js
@@ -5,7 +5,7 @@ import { dirname } from "node:path"
 const __dirname = dirname(fileURLToPath(import.meta.url))
 
 import { FileSystem } from "../../utils/index.js"
-import { parseOutput } from "./node.js"
+import { Suite } from "./node.js"
 
 describe("parseOutput", () => {
 	const fs = new FileSystem({ cwd: __dirname })
@@ -13,18 +13,19 @@ describe("parseOutput", () => {
 	before(async () => {
 		nodeTxt = await fs.load("node.txt")
 	})
-	it("should parse TAP version 13", () => {
-		const parsed = parseOutput(nodeTxt, "", fs)
-		assert.deepStrictEqual(parsed.counts, {
+	it("should parse TAP version 13", async () => {
+		const suite = new Suite({ rows: nodeTxt.split("\n"), fs })
+		const parsed = suite.parse()
+		assert.deepStrictEqual(Object.fromEntries(parsed.counts.entries()), {
 			cancelled: 1 + 0,
-			duration: 661.434,
+			duration: 661.434291,
 			fail: 1 + 0,
 			pass: 1 + 18,
 			skip: 1 + 0,
 			suites: 0 + 3 ,
 			tests: 5 + 18,
 			todo: 1 + 0,
-			types: 102
+			types: 97,
 		})
 		assert.deepStrictEqual(parsed.tests[0].file, "node.test.js")
 		assert.deepStrictEqual(parsed.tests[0].position, [15, 2])
@@ -33,8 +34,8 @@ describe("parseOutput", () => {
 		assert.deepStrictEqual(parsed.tests[4].doc?.failureType, "testTimeoutFailure")
 		assert.deepStrictEqual(parsed.tests[6].type, "pass")
 		assert.deepStrictEqual(parsed.tests[6].doc?.type, "test")
-		assert.deepStrictEqual(parsed.tests[127].file, "src/strategies/fastest.js")
-		assert.deepStrictEqual(parsed.tests[127].position, [75, 11])
+		assert.deepStrictEqual(parsed.tests[119].file, "src/strategies/fastest.js")
+		assert.deepStrictEqual(parsed.tests[119].position, [75, 11])
 	})
 	it("should produce OK", () => {
 		assert.ok(true)
diff --git a/src/cli/testing/node.txt b/src/cli/testing/node.txt
index 00e3880..170f711 100644
--- a/src/cli/testing/node.txt
+++ b/src/cli/testing/node.txt
@@ -291,11 +291,6 @@ Waiting for the debugger to disconnect...
 > tsc
 
 Debugger attached.
-src/Chat/commands/info.js(167,37): error TS2739: Type 'Partial<Chat>' is missing the following properties from type 'Chat': #fs, #db, #path
-src/Chat/commands/test.js(7,10): error TS2305: Module '"../../llm/chatSteps.js"' has no exported member 'parseOutput'.
-src/Chat/commands/test.js(216,37): error TS2739: Type 'Partial<Chat>' is missing the following properties from type 'Chat': #fs, #db, #path
-src/cli/App.js(291,86): error TS2694: Namespace '"/Users/i/src/nan.web/apps/llimo.app/src/llm/chatSteps"' has no exported member 'TestOutput'.
-src/cli/App.js(323,43): error TS2694: Namespace '"/Users/i/src/nan.web/apps/llimo.app/src/llm/chatSteps"' has no exported member 'TestOutput'.
 src/cli/Ui.js(57,41): error TS2769: No overload matches this call.
   Overload 1 of 2, '(locales?: LocalesArgument, options?: NumberFormatOptions | undefined): NumberFormat', gave the following error.
     Argument of type '{ style: string; currency: string; minimumFractionDigits: number; maximumFractionDigits: number; }' is not assignable to parameter of type 'NumberFormatOptions'.
diff --git a/src/llm/AI.js b/src/llm/AI.js
index 08a5503..0b71145 100644
--- a/src/llm/AI.js
+++ b/src/llm/AI.js
@@ -5,6 +5,7 @@ import { createOpenRouter } from '@openrouter/ai-sdk-provider'
 import { streamText, generateText } from 'ai'
 import ModelProvider from "./ModelProvider.js"
 import ModelInfo from './ModelInfo.js'
+import { validateApiKey } from './ProviderConfig.js'
 import Usage from './Usage.js'
 
 /**
@@ -17,6 +18,43 @@ import Usage from './Usage.js'
  * @property {()=>void} [onAbort] called when the stream is aborted
  */
 
+export class AiStrategy {
+	/**
+	 * @param {ModelInfo} model
+	 * @param {number} tokens
+	 * @param {number} [safeAnswerTokens=1_000]
+	 * @returns {boolean}
+	 */
+	shouldChangeModel(model, tokens, safeAnswerTokens = 1e3) {
+		if (model.context_length < tokens + safeAnswerTokens) return true
+		if (model.per_request_limit > 0 && model.per_request_limit < tokens) return true
+		if (model.maximum_output > 0 && model.maximum_output < safeAnswerTokens) return true
+		if (model.pricing.prompt < 0 || model.pricing.completion < 0) return true
+		if (model.volume && model.volume < 100e9) return true
+		if (model.id.endsWith(":free")) return true
+		return false
+	}
+	/**
+	 * @param {Map<string, ModelInfo>} models
+	 * @param {number} tokens
+	 * @param {number} [safeAnswerTokens=1_000]
+	 * @returns {ModelInfo | undefined}
+	 */
+	findModel(models, tokens, safeAnswerTokens = 1e3) {
+		const arr = Array.from(models.values()).filter(
+			(info) => !this.shouldChangeModel(info, tokens, safeAnswerTokens)
+		)
+		if (!arr.length) return
+		arr.sort((a, b) => a.pricing.completion - b.pricing.completion)
+
+		const rows = arr.map((info) => [info.id, info.provider, info.volume, info.pricing.prompt, info.pricing.completion])
+		console.table(rows)
+		console.log("")
+
+		return arr[0]
+	}
+}
+
 /**
  * Wrapper for AI providers.
  *
@@ -41,14 +79,17 @@ export default class AI {
 	 * @param {Object} input
 	 * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo>} [input.models=[]]
 	 * @param {ModelInfo} [input.selectedModel]
+	 * @param {AiStrategy} [input.strategy]
 	 */
 	constructor(input = {}) {
 		const {
 			models = [],
 			selectedModel = this.selectedModel,
+			strategy = new AiStrategy()
 		} = input
 		this.setModels(models)
 		this.selectedModel = selectedModel
+		this.strategy = strategy
 	}
 
 	/**
@@ -214,33 +255,20 @@ export default class AI {
 	 */
 	getProvider(provider) {
 		const [pro] = provider.split("/")
+		try {
+			validateApiKey(pro)
+		} catch (/** @type {any} */ err) {
+			throw new Error(err.message)
+		}
 		switch (pro) {
 			case 'openai':
-				if (!process.env.OPENAI_API_KEY) {
-					throw new Error(`OpenAI API key is missing. Set the OPENAI_API_KEY environment variable.`)
-				}
 				return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
 			case 'cerebras':
-				if (!process.env.CEREBRAS_API_KEY) {
-					throw new Error(
-						`Cerebras API key is missing. Set the CEREBRAS_API_KEY environment variable.` +
-						`\n\n` +
-						`To get an API key:\n` +
-						`1. Visit https://inference-docs.cerebras.ai/\n` +
-						`2. Sign up and get your API key\n` +
-						`3. Export it: export CEREBRAS_API_KEY=your_key_here`
-					)
-				}
 				return createCerebras({ apiKey: process.env.CEREBRAS_API_KEY })
 			case 'huggingface':
-				if (!process.env.HUGGINGFACE_API_KEY) {
-					throw new Error(`HuggingFace API key is missing. Set the HUGGINGFACE_API_KEY environment variable.`)
-				}
-				return createHuggingFace({ apiKey: process.env.HUGGINGFACE_API_KEY })
+				const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY
+				return createHuggingFace({ apiKey: HF_TOKEN })
 			case 'openrouter':
-				if (!process.env.OPENROUTER_API_KEY) {
-					throw new Error(`OpenRouter API key is missing. Set the OPENROUTER_API_KEY environment variable.`)
-				}
 				return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
 			default:
 				throw new Error(`Unknown provider: ${provider}`)
@@ -251,8 +279,8 @@ export default class AI {
 	 * Stream text from a model.
 	 *
 	 * The method forwards the call to `ai.streamText` while providing a set of
-	 * optional hooks that can be used by callers to monitor or control the
-	 * streaming lifecycle.
+	 * optional hooks that can be used by monitor or control the streaming
+	 * lifecycle.
 	 *
 	 * @param {ModelInfo} model
 	 * @param {import('ai').ModelMessage[]} messages
@@ -310,4 +338,24 @@ export default class AI {
 		})
 		return { text, usage }
 	}
+
+	/**
+	 * @throws {Error} When no correspondent model found.
+	 * @param {ModelInfo} model
+	 * @param {number} tokens
+	 * @param {number} [safeAnswerTokens=1_000]
+	 * @returns {ModelInfo | undefined}
+	 */
+	ensureModel(model, tokens, safeAnswerTokens = 1e3) {
+		if (!this.strategy.shouldChangeModel(model, tokens, safeAnswerTokens)) {
+			return model
+		}
+		const found = this.strategy.findModel(this.#models, tokens, safeAnswerTokens)
+		if (!found) {
+			throw new Error("No such model found in " + this.strategy.constructor.name)
+		}
+		this.selectedModel = found
+		return found
+	}
 }
+
diff --git a/src/llm/Architecture.js b/src/llm/Architecture.js
index 292095c..c6a8fb8 100644
--- a/src/llm/Architecture.js
+++ b/src/llm/Architecture.js
@@ -1,12 +1,5 @@
 /**
  * Represents model architecture information.
- * @typedef {Object} Architecture
- * @property {string[]} input_modalities - Input modalities supported by the model
- * @property {string} instruct_type - Instruct type
- * @property {string} modality - Model modality
- * @property {string[]} output_modalities - Output modalities supported by the model
- * @property {string} tokenizer - Tokenizer type
- * @property {number} [context_length] - Context length (if not in main)
  */
 export default class Architecture {
 	/** @type {string[]} - Input modalities supported by the model */
diff --git a/src/llm/Chat.js b/src/llm/Chat.js
index 1fb1ae6..2b55dcb 100644
--- a/src/llm/Chat.js
+++ b/src/llm/Chat.js
@@ -100,23 +100,26 @@ export default class Chat {
 
 	/** @returns {Record<string, string | null>} Allowed files and directories */
 	get allowed() {
-		return {
-			input: "input.md",
-			prompt: "prompt.md",
-			model: "model.json",
-			files: "files.jsonl",
-			inputs: "inputs.jsonl",
-			response: "response.json",
-			parts: "stream.jsonl",
-			stream: "stream.md",
-			chunks: "chunks.jsonl",
-			unknowns: "unknowns.jsonl",
-			answer: "answer.md",
-			reason: "reason.md",
-			usage: "usage.json",
-			fail: "fail.json",
-			messages: null,
-		}
+		return Chat.FILES
+	}
+
+	/** Constants for chat files – single source of truth */
+	static FILES = {
+		input: "input.md",
+		prompt: "prompt.md",
+		model: "model.json",
+		files: "files.jsonl",
+		inputs: "inputs.jsonl",
+		response: "response.json",
+		parts: "stream.jsonl",
+		stream: "stream.md",
+		chunks: "chunks.jsonl",
+		unknowns: "unknowns.jsonl",
+		answer: "answer.md",
+		reason: "reason.md",
+		usage: "usage.json",
+		fail: "fail.json",
+		messages: null,
 	}
 
 	/**
@@ -257,17 +260,6 @@ export default class Chat {
 		return await this.fs.stat(path)
 	}
 
-	/**
-	 * Save the latest prompt
-	 * @param {string} prompt
-	 * @returns {Promise<string>} The prompt path.
-	 */
-	async savePrompt(prompt) {
-		const promptPath = this.#path.resolve(this.dir, "prompt.md")
-		await this.#fs.writeFile(promptPath, prompt)
-		return promptPath
-	}
-
 	/**
 	 * Append to a file
 	 * @param {string} path
@@ -276,28 +268,51 @@ export default class Chat {
 	 */
 	async append(path, data, step) {
 		if (path.startsWith("/")) path = path.slice(1)
-		const file = this.allowed[path]
-		if ("string" === typeof file) path = file
-		if (step) path = "steps/" + String(step).padStart(3, "0") + "/" + path
+		const file = this.allowed[path] ?? path
+		if (step) path = "steps/" + String(step).padStart(3, "0") + "/" + file
 		await this.db.append(path, data)
 	}
 
+	/**
+	 * Reusable path resolution – formats `steps/00X/filename` pattern.
+	 * @param {string} path - File name (e.g., "answer.md")
+	 * @param {number} [step] - Optional step number (prepended as 00X)
+	 * @returns {string}
+	 */
+	static formatStepPath(path, step) {
+		const file = Chat.FILES[path] || path
+		if (step) path = `steps/${String(step).padStart(3, '0')}/${file}`
+		return path
+	}
+
+	/**
+	 * Glob split utility for patterns like "src\/**\/*.js".
+	 * @param {string} pattern - Glob pattern string
+	 * @returns {{ baseDir: string, globPattern: string }}
+	 */
+	static splitGlob(pattern) {
+		const parts = pattern.split("/")
+		let baseDir = "."
+		let globPattern = pattern
+		for (let i = 0; i < parts.length; i++) {
+			if (parts[i].includes("*")) {
+				baseDir = parts.slice(0, i).join("/") || "."
+				globPattern = parts.slice(i).join("/")
+				break
+			}
+		}
+		return { baseDir, globPattern }
+	}
+
 	/**
 	 * @param {string} path
 	 * @param {number} [step]
 	 * @returns {string}
 	 */
 	path(path, step) {
-		let rel = true
-		if (path.startsWith("/")) {
-			path = path.slice(1)
-			rel = false
-		}
-		const file = this.allowed[path] ?? path
-		if ("string" === typeof file) path = file
-		if (step) path = "steps/" + String(step).padStart(3, "0") + "/" + path
+		path = this.allowed[path] ?? path
+		if (step) path = Chat.formatStepPath(path, step)
 		path = this.#path.resolve(this.dir, path)
-		if (rel) path = this.fs.path.relative(this.fs.path.resolve("."), path)
 		return path
 	}
 
@@ -308,8 +323,7 @@ export default class Chat {
 	 * @returns {Promise<number>}
 	 */
 	async calcTokens(text) {
-		return Math.ceil(String(text).length / 3.6)
+		return Math.round(String(text).length / 3.6)
 	}
 }
 
-
diff --git a/src/llm/ModelInfo.js b/src/llm/ModelInfo.js
index baa439e..fca77e8 100644
--- a/src/llm/ModelInfo.js
+++ b/src/llm/ModelInfo.js
@@ -3,6 +3,10 @@ import Architecture from "./Architecture.js"
 import TopProvider from "./TopProvider.js"
 import Limits from "./Limits.js"
 
+/**
+ * @typedef {'live'|'staging'} ProviderStatus
+ */
+
 /**
  * Represents information about a model.
  */
@@ -20,6 +24,8 @@ export default class ModelInfo {
 	/** @type {Limits} - limits of requests and tokens per time */
 	limits = new Limits()
 	/** @type {number} */
+	#volume = 0
+	/** @type {number} */
 	created = 0
 	/** @type {object} */
 	default_parameters = {}
@@ -45,12 +51,12 @@ export default class ModelInfo {
 	supports_structured_output = false
 	/** @type {boolean} */
 	supportsTools = false
-	/** @type {boolean} */
-	supportsStructuredOutput = false
+	/** @type {ProviderStatus} */
+	status = "staging"
 
 	/**
 	 * Constructs a ModelInfo instance.
-	 * @param {Partial<ModelInfo>} input - Partial object with model properties.
+	 * @param {Partial<ModelInfo> & { volume?: number }} input - Partial object with model properties.
 	 */
 	constructor(input = {}) {
 		const {
@@ -73,7 +79,8 @@ export default class ModelInfo {
 			supports_tools = false,
 			supports_structured_output = false,
 			supportsTools = false,
-			supportsStructuredOutput = false,
+			volume = 0,
+			status = this.status,
 		} = input
 		this.id = String(id)
 		this.architecture = new Architecture(architecture)
@@ -94,6 +101,16 @@ export default class ModelInfo {
 		this.supports_tools = Boolean(supports_tools)
 		this.supports_structured_output = Boolean(supports_structured_output)
 		this.supportsTools = Boolean(supportsTools)
-		this.supportsStructuredOutput = Boolean(supportsStructuredOutput)
+		this.status = "live" === status ? "live" : "staging"
+		this.#volume = volume
+	}
+
+	/** @returns {number} The volume of parameters inside model */
+	get volume() {
+		if (this.#volume > 0) return this.#volume
+		const arr = this.id.split("-").filter(
+			w => w.toLowerCase().endsWith("b")
+		).map(w => w.slice(0, -1)).filter(w => !isNaN(parseInt(w)))
+		return 1e9 * Number(arr[0] || 0)
 	}
 }
diff --git a/src/llm/ModelProvider.js b/src/llm/ModelProvider.js
index 9b14107..a008f99 100644
--- a/src/llm/ModelProvider.js
+++ b/src/llm/ModelProvider.js
@@ -13,53 +13,99 @@
  */
 import { FileSystem } from "../utils/index.js"
 
-import getCerebrasInfo from "./providers/cerebras.info.js"
-import getHuggingFaceInfo from "./providers/huggingface.info.js"
+import CerebrasInfo from "./providers/cerebras.info.js"
+import HFInfo from "./providers/huggingface.info.js"
+import Openrouter from "./providers/openrouter.info.js"
 import ModelInfo from "./ModelInfo.js"
 import Pricing from "./Pricing.js"
 
-/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */
+const transformers = {
+	cerebras: CerebrasInfo.makeFlat,
+	huggingface: HFInfo.makeFlat,
+	openrouter: Openrouter.makeFlat,
+}
 
-/** Cache duration – 1 hour (in milliseconds) */
-const CACHE_TTL = 60 * 60 * 1000
+/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */
+/**
+ * @typedef {Object} HuggingFaceProviderInfo
+ * @property {string} provider
+ * @property {string} status
+ * @property {number} context_length
+ * @property {{ input: number, output: number }} pricing
+ * @property {boolean} supports_tools
+ * @property {boolean} supports_structured_output
+ * @property {boolean} is_model_author
+*/
 
-/** Default cache location – inside the project root */
-const CACHE_FILE = "chat/cache/{provider}.jsonl"
+export class CacheConfig {
+	/** @type {number} Cache duration – 1 hour (in milliseconds) */
+	ttl = 60 * 60 * 1e3
+	file = "chat/cache/{provider}.jsonl"
+	/** @param {Partial<CacheConfig>} [input] */
+	constructor(input = {}) {
+		const {
+			ttl = this.ttl,
+			file = this.file,
+		} = input
+		this.ttl = Number(ttl)
+		this.file = String(file)
+	}
+	/**
+	 * @param {string} provider
+	 * @return {string}
+	 */
+	getFile(provider) {
+		return this.file.replaceAll("{provider}", provider)
+	}
+	/**
+	 * @param {number} time File change time in milliseconds
+	 * @param {number} [now] Now time in milliseconds
+	 * @returns {boolean}
+	 */
+	isAlive(time, now = Date.now()) {
+		return (now - time) < this.ttl
+	}
+}
 
 export default class ModelProvider {
+	/** @type {AvailableProvider[]} */
+	static AvailableProviders = ["cerebras", "huggingface", "openrouter"]
 	/** @type {FileSystem} */
 	#fs
-	/** @type {string} absolute path to the cache file */
-	#cachePath
+	/** @type {CacheConfig} */
+	#cache
 
 	constructor(input = {}) {
 		const {
 			fs = new FileSystem(),
+			cache = new CacheConfig(),
 		} = input
 		this.#fs = fs
-		// Resolve the cache file relative to the current working directory.
-		this.#cachePath = this.#fs.path.resolve(CACHE_FILE)
+		this.#cache = cache
 	}
 
 	get cachePath() {
-		return this.#cachePath
+		return this.#fs.path.resolve(this.#cache.file)
+	}
+
+	get cacheConfig() {
+		return this.#cache
 	}
 
 	/**
 	 * Load the cache file if it exists and is fresh.
 	 * @param {string} provider
-	 * @returns {Promise<ModelInfo[] | null>}
+	 * @returns {Promise<object[] | null>}
 	 */
 	async loadCache(provider) {
-		const file = this.#cachePath.replaceAll("{provider}", provider)
-		// const rel = this.#fs.path.relative(this.#fs.cwd, file)
+		const file = this.cacheConfig.getFile(provider)
 		try {
 			if (await this.#fs.access(file)) {
 				const rows = await this.#fs.load(file) ?? []
 				if (!rows.length) return null
 				const stats = await this.#fs.info(file)
-				if ((Date.now() - stats.mtimeMs) < CACHE_TTL) {
-					return rows.map(row => new ModelInfo(row))
+				if (this.cacheConfig.isAlive(stats.mtimeMs)) {
+					return rows
 				}
 			}
 		} catch (/** @type {any} */ err) {
@@ -75,8 +121,7 @@ export default class ModelProvider {
 	 * @param {string} provider
 	 */
 	async writeCache(data, provider) {
-		const file = this.#cachePath.replaceAll("{provider}", provider)
-		await this.#fs.save(file, data)
+		await this.#fs.save(this.cacheConfig.getFile(provider), data)
 	}
 
 	/**
@@ -158,7 +203,7 @@ export default class ModelProvider {
 
 	/**
 	 * Flatten multi-provider entries into separate ModelInfo instances.
-	 * @param {Array<ModelInfo & { providers?: Partial<ModelInfo> }>} arr
+	 * @param {Array<ModelInfo & { providers?: HuggingFaceProviderInfo[] }>} arr
 	 * @param {AvailableProvider} provider
 	 * @param {Array<[string, Partial<ModelInfo>]>} [predefined]
 	 * @returns {ModelInfo[]}
@@ -184,6 +229,7 @@ export default class ModelProvider {
 						continue
 					}
 					const { providers, ...rest } = model
+					// @todo transform platform-specific info into ModelInfo before pushing it
 					push(new ModelInfo({ ...pre, ...rest, ...opts, provider: pro }))
 				}
 			} else {
@@ -250,19 +296,18 @@ export default class ModelProvider {
 		} = options
 
 		/** @type {AvailableProvider[]} */
-		const providerNames = ["cerebras", "openrouter", "huggingface"]
 		const all = []
 
-		for (const name of providerNames) {
+		for (const name of ModelProvider.AvailableProviders) {
 			try {
-				onBefore(name, providerNames)
+				onBefore(name, ModelProvider.AvailableProviders)
 				let raw = []
 				// Fetch if possible, else use static only.
 				try {
 					// Try cache first.
 					const cached = noCache ? null : await this.loadCache(name)
 					raw = cached ?? await this.fetchFromProvider(name)
-					if (!noCache) await this.writeCache(raw, name)
+					if (!noCache && !cached) await this.writeCache(raw, name)
 				} catch (/** @type {any} */ err) {
 					console.warn(`Fetch failed for ${name}, using static: ${err.message}`)
 					raw = [] // Rely on predefined.
@@ -282,18 +327,11 @@ export default class ModelProvider {
 	/**
 	 * @param {Array} raw
 	 * @param {AvailableProvider} name
+	 * @returns {}
 	 */
 	flatten(raw, name) {
-		let predefined = []
-
-		// Load static info for providers with fallbacks.
-		if (name === "cerebras") {
-			predefined = getCerebrasInfo()?.models ?? [] // Assume returns Array<[string, Partial<ModelInfo>]>
-		} else if (name === "huggingface") {
-			predefined = getHuggingFaceInfo()?.models ?? [] // Array<[string, Partial<ModelInfo>]>
-		}
-
-		return this._makeFlat(raw, name, predefined)
+		const transformer = transformers[name] ?? (models => models)
+		return transformer(raw)
 	}
 }
 
diff --git a/src/llm/ModelProvider.test.js b/src/llm/ModelProvider.test.js
index 080987e..b3c881e 100644
--- a/src/llm/ModelProvider.test.js
+++ b/src/llm/ModelProvider.test.js
@@ -1,8 +1,11 @@
-import { describe, it, beforeEach, mock, afterEach } from "node:test"
+import { before, describe, it, beforeEach, mock, afterEach } from "node:test"
 import assert from "node:assert/strict"
 import ModelProvider from "./ModelProvider.js"
 import { FileSystem } from "../utils/index.js"
 import ModelInfo from "./ModelInfo.js"
+import { fileURLToPath } from "node:url"
+import { dirname } from "node:path"
+const __dirname = dirname(fileURLToPath(import.meta.url))
 
 class TestFileSystem extends FileSystem {
 	#logs = []
@@ -73,18 +76,25 @@ class TestFileSystem extends FileSystem {
 	}
 }
 
-// Mock static info functions.
-const mockHFInfo = [["test-model", { context_length: 8192, pricing: { prompt: 0.1 } }]]
-const mockCerebrasInfo = [["cerebras-test", { context_length: 4096, provider: "cerebras" }]]
-
 describe("ModelProvider", () => {
 	/** @type {ModelProvider} */
 	let provider
 	let mockFS
 	let mockFetch
+	/** @type {Record<string, object[]>} */
+	let cache = {}
+
+	before(async () => {
+		const fs = new FileSystem({ cwd: __dirname })
+		for (const pro of ModelProvider.AvailableProviders) {
+			cache[pro] = await fs.load(`ModelProvider.test.${pro}.jsonl`) ?? []
+		}
+	})
 
 	beforeEach(() => {
-		mockFS = new FileSystem()
+		mockFS = new TestFileSystem({
+			data: Object.entries(cache).map(([pro, arr]) => [`chat/cache/${pro}.jsonl`, arr])
+		})
 		provider = new ModelProvider({ fs: mockFS })
 		// Mock fetch globally.
 		mockFetch = mock.fn(async () => ({ json: async () => [] }))
@@ -93,10 +103,10 @@ describe("ModelProvider", () => {
 		// mock.doMock("./providers/huggingface.info.js", () => ({ models: mockHFInfo }))
 		// mock.doMock("./providers/cerebras.info.js", () => ({ models: mockCerebrasInfo }))
 		// Mock FS for cache.
-		mock.method(mockFS, "access", async () => false)
-		mock.method(mockFS, "load", async () => null)
-		mock.method(mockFS, "save", async () => { })
-		mock.method(mockFS, "info", async () => ({ mtimeMs: 0 }))
+		// mock.method(mockFS, "access", async () => false)
+		// mock.method(mockFS, "load", async () => null)
+		// mock.method(mockFS, "save", async () => { })
+		// mock.method(mockFS, "info", async () => ({ mtimeMs: 0 }))
 	})
 
 	afterEach(() => {
@@ -110,39 +120,20 @@ describe("ModelProvider", () => {
 	})
 
 	describe("cache handling", () => {
-		it("loads fresh cache if within TTL", async () => {
-			const fs = new TestFileSystem({
-				data: [
-					["chat/cache/cerebras.jsonl", [
-						{ id: "gpt-oss-120b", provider: "cerebras" },
-					]],
-					["chat/cache/openrouter.jsonl", [
-						{ id: "qwen-3-480b", provider: "openrouter" },
-					]],
-				]
+		for (const pro of ModelProvider.AvailableProviders) {
+			it(`loads fresh ${pro} cache if within TTL`, async () => {
+				const provider = new ModelProvider({ fs: mockFS })
+				const cerebras = await provider.loadCache(pro)
+				assert.strictEqual(cerebras.length, 1)
+				assert.deepStrictEqual(cerebras[0], cache[pro][0])
 			})
-			const provider = new ModelProvider({ fs })
-
-			const cerebras = await provider.loadCache('cerebras')
-			assert.strictEqual(cerebras.length, 1)
-			assert.ok(cerebras[0] instanceof ModelInfo)
-			assert.deepStrictEqual(cerebras.map(m => [m.id, m.provider, m.context_length]), [
-				["gpt-oss-120b", "cerebras", 0],
-			])
-			const openrouter = await provider.loadCache('openrouter')
-			assert.strictEqual(openrouter.length, 1)
-			assert.ok(openrouter[0] instanceof ModelInfo)
-			assert.deepStrictEqual(openrouter.map(m => [m.id, m.provider, m.context_length]), [
-				["qwen-3-480b", "openrouter", 0],
-			])
-		})
+		}
 
 		it("ignores stale cache beyond TTL", async () => {
 			const fs = new TestFileSystem({
 				data: [
-					["chat/models.jsonl", [
+					["chat/cache/cerebras.jsonl", [
 						{ id: "gpt-oss-120b", provider: "cerebras" },
-						{ id: "qwen-3-480b", provider: "openrouter" },
 					]]
 				]
 			})
@@ -154,7 +145,7 @@ describe("ModelProvider", () => {
 			})
 			const provider = new ModelProvider({ fs })
 
-			const result = await provider.loadCache()
+			const result = await provider.loadCache("cerebras")
 			assert.strictEqual(result, null)
 		})
 
@@ -228,31 +219,6 @@ describe("ModelProvider", () => {
 			provider = new ModelProvider({ fs: mockFS })
 		})
 
-		it.todo("returns empty map from stale/no cache, uses static on fetch fail", async () => {
-			// Simulate all fetches failing.
-			provider.fetch = async () => { throw new Error("fetch fail") }
-
-			const result = await provider.getAll()
-			assert.ok(result instanceof Map)
-			assert.ok(result.size > 0, "Should include static models from HF/Cerebras") // From mocks.
-		})
-
-		it("merges fetched data with static fallbacks", async () => {
-			provider.loadCache = async () => null
-			provider.fetch = async (url, options) => {
-				if (url.includes("huggingface")) {
-					return { ok: true, json: async () => [{ id: "fetched-hf", context_length: 8192 }] }
-				}
-				return { ok: true, json: async () => [] }
-			}
-
-			const result = await provider.getAll()
-			const entry = [...result.values()][0]
-			assert.equal(entry.provider, "huggingface")
-			assert.equal(entry.id, "fetched-hf")
-			assert.equal(entry.context_length, 8192)
-		})
-
 		it("caches and loads on second call", async () => {
 			const fs = new TestFileSystem()
 			const provider = new ModelProvider({ fs })
@@ -278,5 +244,20 @@ describe("ModelProvider", () => {
 			assert.strictEqual(mockData.mock.calls.length, 3)
 		})
 	})
+
+	describe("correct data", () => {
+		it("should properly load models info", async () => {
+			const models = await provider.getAll()
+			let model = models.get("gpt-oss-120b@cerebras")
+			assert.equal(model.pricing.prompt, 0)
+			assert.equal(model.pricing.completion, 0)
+			model = models.get("openai/gpt-oss-120b@huggingface/cerebras")
+			assert.equal(model.pricing.prompt, 0.25)
+			assert.equal(model.pricing.completion, 0.69)
+			model = models.get("openai/gpt-5.1-codex-max@openrouter")
+			assert.equal(model.pricing.prompt, 1.25)
+			assert.equal(model.pricing.completion, 10)
+		})
+	})
 })
 
diff --git a/src/llm/Pricing.js b/src/llm/Pricing.js
index 7f4437b..8979336 100644
--- a/src/llm/Pricing.js
+++ b/src/llm/Pricing.js
@@ -24,9 +24,9 @@ export default class Pricing {
 	speed = -1
 
 	/**
-	 * @param {Partial<Pricing>} input
+	 * @param {Partial<Pricing> & { input?: number, output?: number }} options
 	 */
-	constructor(input = {}) {
+	constructor(options = {}) {
 		const {
 			completion = this.completion,
 			image = this.image,
@@ -37,13 +37,15 @@ export default class Pricing {
 			request = this.request,
 			web_search = this.web_search,
 			speed = this.speed,
-		} = input
-		this.completion = Number(completion)
+			input,
+			output,
+		} = options
+		this.completion = Number(output ?? completion)
 		this.image = Number(image)
 		this.input_cache_read = Number(input_cache_read)
 		this.input_cache_write = Number(input_cache_write)
 		this.internal_reasoning = Number(internal_reasoning)
-		this.prompt = Number(prompt)
+		this.prompt = Number(input ?? prompt)
 		this.request = Number(request)
 		this.web_search = Number(web_search)
 		this.speed = Number(speed)
diff --git a/src/llm/chatLoop.js b/src/llm/chatLoop.js
index e0c20e5..0c19577 100644
--- a/src/llm/chatLoop.js
+++ b/src/llm/chatLoop.js
@@ -8,6 +8,7 @@ import Ui from "../cli/Ui.js"
 import ModelInfo from "./ModelInfo.js"
 import { runCommand } from "../cli/runCommand.js"
 import Usage from "./Usage.js"
+import ChatOptions from "../Chat/Options.js"
 
 function isWindowLimit(err) {
 	return [err?.status, err?.statusCode].includes(400) && err?.data?.code === "context_length_exceeded"
@@ -234,67 +235,3 @@ export async function sendAndStream(options) {
 		clearInterval(chatting)
 	}
 }
-
-/**
- * Handles post-stream processing: add to chat, save, unpack and test.
- * @param {Object} input
- * @param {Chat} input.chat
- * @param {Ui} input.ui
- * @param {string} input.answer
- * @param {string} input.reason
- * @param {number} input.step
- * @param {boolean} [input.isYes=false]
- * @returns {Promise<{shouldContinue: boolean, testsCode: string | boolean}>}
- */
-export async function postStreamProcess(input) {
-	const {
-		chat, ui, answer, reason, step, isYes = false,
-	} = input
-	chat.add({ role: "assistant", content: answer })
-	await chat.save()
-	ui.console.info("")
-	const git = new Git({ dry: true })
-	if (reason) {
-		ui.console.info(`+ reason (${chat.path("reason.md", step)})`)
-	}
-	ui.console.info(`+ answer (${chat.path("answer.md", step)})`)
-	ui.console.info("") // Extra newline to avoid overlap
-
-	// 6. decode answer & run tests
-	const onData = (d) => ui.write(String(d))
-	const { testsCode, shouldContinue } = await decodeAnswerAndRunTests(
-		ui,
-		chat,
-		async (cmd, args, opts = {}) => runCommand(cmd, args, { ...opts, onData }),
-		isYes,
-		step
-	)
-	if (!shouldContinue) {
-		return { shouldContinue: false, testsCode }
-	}
-
-	// 7. check if tests passed – same logic as original script
-	if (true === testsCode) {
-		// Task is complete, let's commit and exit
-		ui.console.info(`  ${GREEN}+ Task is complete${RESET}`)
-		const DONE_BRANCH = ""
-		if (DONE_BRANCH) {
-			await git.renameBranch(DONE_BRANCH)
-			await git.push(DONE_BRANCH)
-		}
-		return { shouldContinue: false, testsCode: true }
-	} else {
-		let consecutiveErrors = 0 // Assume tracked in caller
-		const MAX_ERRORS = 9
-		consecutiveErrors++
-		if (consecutiveErrors >= MAX_ERRORS) {
-			ui.console.error(`LLiMo stuck after ${MAX_ERRORS} consecutive errors.`)
-			// @todo write fail log
-			return { shouldContinue: false, testsCode }
-		}
-	}
-
-	// 8. commit step and continue
-	// await git.commitAll(`step ${step}: response and test results`)
-	return { shouldContinue: true, testsCode }
-}
diff --git a/src/llm/chatProgress.js b/src/llm/chatProgress.js
index 3b91877..40e6365 100644
--- a/src/llm/chatProgress.js
+++ b/src/llm/chatProgress.js
@@ -48,7 +48,7 @@ export function formatChatProgress(input) {
 
 	/* READ */
 	if (usage.inputTokens) {
-		const endAt = clock.reasonTime ?? clock.answerTime ?? now
+		const endAt = clock.reasonTime || clock.answerTime || now
 		const elapsed = safe((endAt - clock.startTime) / 1e3)
 		const speed = elapsed > 0 ? Math.round(usage.inputTokens / elapsed) : 0
 		map.set("read", { endAt, elapsed, speed, price: costs.input, tokens: usage.inputTokens })
@@ -56,7 +56,7 @@ export function formatChatProgress(input) {
 
 	/* REASON */
 	if (usage.reasoningTokens && clock.reasonTime) {
-		const endAt = clock.answerTime ?? now
+		const endAt = clock.answerTime || now
 		const elapsed = safe((endAt - clock.reasonTime) / 1e3)
 		const speed = elapsed > 0 ? Math.round(usage.reasoningTokens / elapsed) : 0
 		map.set("reason", { endAt, elapsed, speed, price: costs.reason, tokens: usage.reasoningTokens })
diff --git a/src/llm/chatSteps.js b/src/llm/chatSteps.js
index c9a4584..44ccd62 100644
--- a/src/llm/chatSteps.js
+++ b/src/llm/chatSteps.js
@@ -5,19 +5,18 @@
  *
  * @module utils/chatSteps
  */
-import { Stats } from 'node:fs'
-
 import Chat from "./Chat.js"
 import AI from "./AI.js"
 import { generateSystemPrompt } from "./system.js"
 import { unpackAnswer } from "./unpack.js"
-import { BOLD, GREEN, ITALIC, RED, RESET, YELLOW } from "../cli/ANSI.js"
+import { BOLD, GREEN, ITALIC, MAGENTA, RED, RESET, YELLOW } from "../cli/ANSI.js"
 import FileSystem from "../utils/FileSystem.js"
 import Markdown from "../utils/Markdown.js"
-import Ui from "../cli/Ui.js"
+import Ui, { UiStyle } from "../cli/Ui.js"
 import ModelInfo from './ModelInfo.js'
 import ChatOptions from '../Chat/Options.js'
-import { parseOutput } from '../cli/testing/node.js'
+import { parseOutput, Suite } from '../cli/testing/node.js'
+import { testingProgress, testingStatus } from '../cli/testing/progress.js'
 
 /**
  * Read the input either from STDIN or from the first CLI argument.
@@ -128,9 +127,11 @@ export async function copyInputToChat(inputFile, input, chat, ui, step = 1) {
 	if (!inputFile) return
 	const file = chat.db.path.basename(inputFile)
 	const full = chat.path("input")
+	let rel = chat.fs.path.relative(chat.fs.cwd, full)
+	if (rel.startsWith("..")) rel = full
 	await chat.save("input", input, step)
 	ui.console.debug(`> preparing ${file} (${inputFile})`)
-	ui.console.success(`+ ${file} (${full})`)
+	ui.console.success(`+ ${file} (${rel})`)
 }
 
 /**
@@ -264,14 +265,14 @@ export async function decodeAnswer({ ui, chat, options, logs = [] }) {
  * @param {Chat} param0.chat
  * @param {Function} param0.runCommand
  * @param {number} [param0.step=1]
+ * @param {(chunk) => void} [param0.onData]
  * @returns {Promise<import('../cli/runCommand.js').runCommandResult & { parsed: TestOutput }>}
  */
-export async function runTests({ ui, chat, runCommand, step = 1 }) {
+export async function runTests({ ui, chat, runCommand, step = 1, onData = (chunk) => ui.write(chunk) }) {
 	// Run `pnpm test:all` with live output
-	ui.console.info("@ Running tests...")
-	const onDataLive = (d) => ui.write(d)
+	ui.console.info("@ Running tests")
 	ui.console.debug("% pnpm test:all")
-	const result = await runCommand("pnpm", ["test:all"], { onData: onDataLive })
+	const result = await runCommand("pnpm", ["test:all"], { onData })
 	result.parsed = parseOutput(result.testStdout ?? "", result.testStderr ?? "")
 
 	// Save per‑step test output
@@ -282,22 +283,106 @@ export async function runTests({ ui, chat, runCommand, step = 1 }) {
 	return result
 }
 
+/**
+ *
+ * @param {import('../cli/testing/node.js').TestInfo[]} tests
+ * @param {Ui} ui
+ * @returns {any[][]}
+ */
+export function renderTests(tests, ui = new Ui()) {
+	const stderr = []
+	tests.forEach(t => {
+		stderr.push([`${t.file}:${t.position?.[0]}:${t.position?.[1]}`, ui.createStyle({ paddingLeft: 2 })])
+		stderr.push([t.text, ui.createStyle({ paddingLeft: 4 })])
+		if (t.doc.error) stderr.push([t.doc?.error, ui.createStyle({ paddingLeft: 6 })])
+		if (t.doc.stack) stderr.push([t.doc?.stack, ui.createStyle({ paddingLeft: 8 })])
+		stderr.push([""])
+	})
+	return stderr
+}
+
+/**
+ *
+ * @param {Object} input
+ * @param {Ui} input.ui
+ * @param {"fail" | "skip" | "todo"} [input.type]
+ * @param {import('../cli/testing/node.js').TestInfo[]} [input.tests=[]]
+ * @param {string[]} [input.content=[]]
+ * @returns {Promise<boolean>}
+ */
+export async function printAnswer(input) {
+	let {
+		ui,
+		type = "fail",
+		tests = [],
+		content = [],
+	} = input
+	const types = {
+		fail: ["fail", "cancelled", "types"],
+	}
+
+	let ans = await ui.askYesNo(`\n${MAGENTA}? Do you want to continue fixing ${type} tests? (y)es, (n)o, (s)how, ., <message> % `)
+
+	const arr = tests.filter(t => (types[type] ?? [type]).includes(t.type))
+	ui.console.info("")
+
+	const stderr = renderTests(arr)
+	if (["show", "s"].includes(ans.toLowerCase())) {
+		stderr.forEach(args => ui.console.info(...args))
+		ans = await ui.askYesNo(`${MAGENTA}? Do you want to continue fixing ${type} tests? (y)es, (n)o, ., <message> % `)
+	}
+	if ("no" === ans) {
+		return false
+	}
+	if ("yes" === ans) {
+		// just continue
+	}
+	else if ("." === ans) {
+		// @todo read input file such as me.md and add as content.push(fileContent)
+	}
+	else {
+		content.push(ans)
+	}
+	stderr.map(args => args.filter(a => !(a instanceof UiStyle)).join(" ")).forEach(a => content.push(a))
+	arr.forEach(t => content.push(`- [](${t.file})`))
+	return true
+}
+
 /**
  * Decode the answer markdown, unpack if confirmed, run tests, parse results,
  * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
  * tests, if they are.
  *
- * @param {import("../cli/Ui.js").default} ui User interface instance
- * @param {Chat} chat Chat instance (used for paths)
- * @param {import('../cli/runCommand.js').runCommandFn} runCommand Function to execute shell commands
- * @param {ChatOptions} options Always yes to user prompts
- * @param {number} [step] Optional step number for per-step files
- * @returns {Promise<{testsCode: boolean, shouldContinue: boolean, test: TestOutput}>}
+ * @param {Object} input
+ * @param {import("../cli/Ui.js").default} input.ui User interface instance
+ * @param {FileSystem} [input.fs]
+ * @param {Chat} input.chat Chat instance (used for paths)
+ * @param {import('../cli/runCommand.js').runCommandFn} input.runCommand Function to execute shell commands
+ * @param {ChatOptions} input.options Always yes to user prompts
+ * @param {number} [input.step] Optional step number for per-step files
+ * @returns {Promise<{testsCode?: boolean, shouldContinue: boolean, test?: import('../cli/testing/node.js').TapParseResult}>}
  */
-export async function decodeAnswerAndRunTests(ui, chat, runCommand, options, step = 1) {
+export async function decodeAnswerAndRunTests(input) {
+	const {
+		ui, fs = new FileSystem(), chat, runCommand, options, step = 1
+	} = input
 	const logs = []
-	await decodeAnswer({ ui, chat, options, logs })
-	const { stdout: testStdout, stderr: testStderr, exitCode } = await runTests({ ui, chat, runCommand, step })
+	try {
+		const answered = await decodeAnswer({ ui, chat, options, logs })
+		if (!answered.shouldContinue) {
+			return { shouldContinue: false }
+		}
+	} catch (err) {
+		if (!options.isFix) {
+			throw err
+		}
+	}
+	const now = Date.now()
+	const output = []
+	const testing = testingProgress({ ui, fs, output, rows: 12, prefix: "  " })
+	const onData = chunk => output.push(...String(chunk).split("\n"))
+	const { stdout: testStdout, stderr: testStderr, exitCode } = await runTests({ ui, chat, runCommand, step, onData })
+	clearInterval(testing)
 
 	// Append test output to log
 	logs.push("#### pnpm test:all")
@@ -310,62 +395,42 @@ export async function decodeAnswerAndRunTests(ui, chat, runCommand, options, ste
 	await chat.db.append("prompt.md", logs.join("\n"))
 
 	// Parse test results
-	const parsed = parseOutput(testStdout, testStderr)
-	const { fail, cancelled, pass, todo, skip, types } = parsed.counts
-
-	// Build coloured summary
-	let summary = "Tests: "
-	summary += fail > 0 ? `${RED}${fail} fail${RESET}` : "0 fail"
-	summary += " | "
-	summary += cancelled > 0 ? `${YELLOW}${cancelled} cancelled${RESET}` : "0 cancelled"
-	summary += " | "
-	summary += pass > 0 ? `${GREEN}${pass} pass${RESET}` : "0 pass"
-	summary += " | "
-	summary += todo > 0 ? `${YELLOW}${todo} todo${RESET}` : "0 todo"
-	summary += " | "
-	summary += skip > 0 ? `${YELLOW}${skip} skip${RESET}` : "0 skip"
-	summary += " | "
-	summary += types > 0 ? `${YELLOW}${types} types${RESET}` : "0 types"
-
-	ui.console.info(summary)
+	const suite = new Suite({ rows: [...testStdout.split("\n"), ...testStderr.split("\n")] })
+	const parsed = suite.parse()
+	const fail = parsed.counts.get("fail") ?? 0
+	const cancelled = parsed.counts.get("cancelled") ?? 0
+	const types = parsed.counts.get("types") ?? 0
+	const todo = parsed.counts.get("todo") ?? 0
+	const skip = parsed.counts.get("skip") ?? 0
+	// const { fail, cancelled, pass, todo, skip, types } = parsed.counts
+	ui.overwriteLine("  " + testingStatus(parsed, ui.formats.timer((Date.now() - now) / 1e3)))
+	ui.console.info("")
+	// ui.console.info()
 
 	let shouldContinue = true
 
 	if (!options.isYes) {
 		let continuing = false
+		const content = []
 		if (fail > 0 || cancelled > 0 || types > 0) {
-			const ans = await ui.askYesNo("Do you want to continue fixing fail tests? (Y)es, No, ., <message> % ")
-			if (ans !== "yes") {
-				shouldContinue = false
-				if (ans !== "no" && ans !== ".") {
-					chat.add({ role: "user", content: ans })
-				}
-				return { testsCode: ans === "yes" ? true : false, shouldContinue: false, test: parsed }
+			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "fail" })
+			if (!continuing) {
+				return { testsCode: false, shouldContinue: false, test: parsed }
 			}
-			continuing = true
 		}
 		if (shouldContinue && todo > 0) {
-			const ans = await ui.askYesNo("Do you want to continue with todo tests fixing? (Y)es, No, ., <message> % ")
-			if (ans !== "yes" && !continuing) {
-				shouldContinue = false
-				if (ans !== "no" && ans !== ".") {
-					chat.add({ role: "user", content: ans })
-				}
+			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "todo" })
+			if (!continuing) {
 				return { testsCode: false, shouldContinue: false, test: parsed }
 			}
-			continuing = true
 		}
 		if (shouldContinue && skip > 0) {
-			const ans = await ui.askYesNo("Do you want to continue with skipped tests fixing? (Y)es, No, ., <message> % ")
-			if (ans !== "yes" && !continuing) {
-				shouldContinue = false
-				if (ans !== "no" && ans !== ".") {
-					chat.add({ role: "user", content: ans })
-				}
+			continuing = await printAnswer({ tests: parsed.tests, ui, content, type: "skip" })
+			if (!continuing) {
 				return { testsCode: false, shouldContinue: false, test: parsed }
 			}
-			continuing = true
 		}
+		chat.add({ role: "user", content: content.join("\n") })
 		if (shouldContinue && fail === 0 && cancelled === 0 && types === 0 && todo === 0 && skip === 0) {
 			ui.console.success("All tests passed.")
 			return { testsCode: true, shouldContinue: false, test: parsed }
diff --git a/src/llm/chatSteps.test.js b/src/llm/chatSteps.test.js
index bb65440..cc9ca08 100644
--- a/src/llm/chatSteps.test.js
+++ b/src/llm/chatSteps.test.js
@@ -148,11 +148,14 @@ describe("chatSteps – decodeAnswerAndRunTests (mocked)", () => {
 			db: new FileSystem(),
 			messages: [{ role: "assistant", content: "test" }]
 		}
-		const mockUiMock = {
-			...mockUi,
-			askYesNo: async () => "yes"
-		}
-		const result = await chatSteps.decodeAnswerAndRunTests(mockUiMock, mockChat, mockRunCommand, true)
+		const mockUiMock = new Ui({ ...mockUi })
+		mockUiMock.askYesNo = async () => "yes"
+		const result = await chatSteps.decodeAnswerAndRunTests({
+			ui: mockUiMock,
+			chat: mockChat,
+			runCommand: mockRunCommand,
+			options: { isYes: true },
+		})
 		assert.ok(result.testsCode !== undefined)
 	})
 })
diff --git a/src/llm/providers/cerebras.info.js b/src/llm/providers/cerebras.info.js
index d039ed6..7030cc2 100644
--- a/src/llm/providers/cerebras.info.js
+++ b/src/llm/providers/cerebras.info.js
@@ -22,6 +22,7 @@
  */
 
 import ModelInfo from "../ModelInfo.js"
+import Pricing from "../Pricing.js"
 
 /** @type {{ models: Array<[string, Partial<ModelInfo>]> }} */
 const free = {
@@ -203,10 +204,14 @@ const pro = {}
 
 const max = {}
 
-export default function getInfo(plan = "free") {
-	if ("free" === plan) return free
-	if ("developer" === plan) return developer
-	if ("pro" === plan) return pro
-	if ("max" === plan) return max
-	return {}
+/**
+ * @param {object[]} models
+ * @returns {ModelInfo[]}
+ */
+export function makeFlat(models) {
+	return models.map(m => new ModelInfo({ ...m, provider: "cerebras", pricing: new Pricing({ prompt: 0, completion: 0 }) }))
+}
+
+export default {
+	makeFlat
 }
diff --git a/src/llm/providers/huggingface.info.js b/src/llm/providers/huggingface.info.js
index 22fd4f6..a861123 100644
--- a/src/llm/providers/huggingface.info.js
+++ b/src/llm/providers/huggingface.info.js
@@ -1,235 +1,98 @@
+import Architecture from "../Architecture.js"
+import ModelInfo from "../ModelInfo.js"
+import Pricing from "../Pricing.js"
+
 /**
- * Static model information for Hugging Face Inference API.
- *
- * These are popular instruct-tuned models available on the free tier of the
- * Hugging Face Inference API. Pricing is set to 0 for free usage; paid tiers
- * may have different costs based on compute time.
- *
- * Models are selected for chat/instruction following. Context lengths and
- * parameters are approximate from model cards.
- *
- * Note: Access to some models (e.g., Llama) may require Hugging Face approval.
- *
- * Pricing is provided per 1M tokens (e.g., 2.25 for $2.25 per 1M tokens).
- * This matches OpenRouter format; display scales accordingly.
- *
- * Subproviders (e.g., cerebras, zai-org) have specific pricing from their docs.
- * Free tier models use 0 pricing.
+ * @returns {{ models: readonly Array<[string, object]> }}
  */
+export function getModels() {
+	return {
+		models: [
+			["zai-org/GLM-4.6", { providers: [{ provider: "cerebras", context_length: 200_000 }] }],
+			["openai/gpt-oss-120b", { providers: [{ provider: "cerebras", context_length: 200_000 }] }],
+			["Qwen/Qwen3-32B", { providers: [{ provider: "cerebras", context_length: 200_000 }] }],
+			["Qwen/Qwen3-235B-A22B-Instruct-2507", { providers: [{ provider: "cerebras", context_length: 200_000 }] }],
+		]
+	}
+}
 
-import ModelInfo from "../ModelInfo.js"
+/**
+ * @typedef {Object} HuggingFaceArchitecture
+ * @property {string[]} input_modalities - List of input modalities (e.g., ["text"], ["text","image"])
+ * @property {string[]} output_modalities - List of output modalities (e.g., ["text"])
+ */
 
-/** @type {Array<[string, Partial<ModelInfo>]>} */
-const freeModels = [
-	[
-		"mistralai/Mistral-7B-Instruct-v0.2",
-		{
-			parameters: 7e9,
-			pricing: { prompt: 0, completion: 0, input_cache_read: 0, speed: 50 },
-			context_length: 32768,
-			architecture: { modality: "text", instruct_type: "chatml" },
-			name: "Mistral 7B Instruct v0.2",
-			description: "Efficient instruct model for chat and tasks"
-		},
-	],
-	[
-		"meta-llama/Llama-2-7b-chat-hf",
-		{
-			parameters: 7e9,
-			pricing: { prompt: 0, completion: 0, input_cache_read: 0, speed: 40 },
-			context_length: 4096,
-			architecture: { modality: "text", instruct_type: "llama2" },
-			name: "Llama 2 7B Chat",
-			description: "Meta's chat-tuned Llama 2 model"
-		},
-	],
-	[
-		"microsoft/DialoGPT-medium",
-		{
-			parameters: 345e6,
-			pricing: { prompt: 0, completion: 0, input_cache_read: 0, speed: 100 },
-			context_length: 1024,
-			architecture: { modality: "text" },
-			name: "DialoGPT Medium",
-			description: "Microsoft's conversational GPT model"
-		},
-	],
-]
+/**
+ * @typedef {Object} HuggingFacePricing
+ * @property {number} input - Price per input token (or unit) in USD
+ * @property {number} output - Price per output token (or unit) in USD
+ */
 
-/** @type {Array<[string, Partial<ModelInfo>]>} */
-const cerebrasModels = [
-	["zai-org/GLM-4.6", {
-		parameters: 4.6e9,
-		pricing: { prompt: 2.25, completion: 2.75, input_cache_read: 0, speed: 1000 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "ZAIZAI GLM 4.6",
-		description: "High-speed GLM variant on Cerebras"
-	}],
-	["openai/gpt-oss-120b", {
-		parameters: 120e9,
-		pricing: { prompt: 0.35, completion: 0.75, input_cache_read: 0, speed: 3000 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "OpenAI GPT OSS 120B",
-		description: "Large OSS model optimized for Cerebras"
-	}],
-	["meta-llama/Llama-3.1-8B-Instruct", {
-		parameters: 8e9,
-		pricing: { prompt: 0.10, completion: 0.10, input_cache_read: 0, speed: 2200 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Meta Llama 3.1 8B Instruct",
-		description: "Compact Llama variant on Cerebras"
-	}],
-	["meta-llama/Llama-3.3-70B-Instruct", {
-		parameters: 70e9,
-		pricing: { prompt: 0.85, completion: 1.20, input_cache_read: 0, speed: 2100 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Meta Llama 3.3 70B Instruct",
-		description: "Advanced Llama on Cerebras"
-	}],
-	["Qwen/Qwen3-32B", {
-		parameters: 32e9,
-		pricing: { prompt: 0.40, completion: 0.80, input_cache_read: 0, speed: 2600 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Qwen 3 32B",
-		description: "Qwen instruct model on Cerebras"
-	}],
-	["Qwen/Qwen3-235B-A22B-Instruct-2507", {
-		parameters: 235e9,
-		pricing: { prompt: 0.60, completion: 1.20, input_cache_read: 0, speed: 1400 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Qwen 3 235B Instruct",
-		description: "Large Qwen variant on Cerebras"
-	}],
-	["Qwen/Qwen3-235B-A22B-Thinking-2507", {
-		parameters: 235e9,
-		pricing: { prompt: 0.60, completion: 1.20, input_cache_read: 0, speed: 1400 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Qwen 3 235B Thinking",
-		description: "Thinking variant of Qwen on Cerebras"
-	}],
-	["Qwen/Qwen3-Coder-480B-A35B-Instruct", {
-		parameters: 480e9,
-		pricing: { prompt: 0.40, completion: 0.80, input_cache_read: 0, speed: 2600 },
-		context_length: 131072,
-		architecture: { modality: "text" },
-		name: "Qwen 3 Coder 480B",
-		description: "Coder-focused Qwen on Cerebras"
-	}]
-]
+/**
+ * @typedef {Object} HuggingFaceProviderInfo
+ * @property {string} provider - Provider identifier (e.g., "novita", "zai-org")
+ * @property {import("../ModelInfo.js").ProviderStatus} status - Provider status (e.g., "live", "staging")
+ * @property {number} [context_length] - Maximum context length supported by the provider
+ * @property {HuggingFacePricing} [pricing] - Pricing details, if available
+ * @property {boolean} [supports_tools] - Whether the provider supports tool usage
+ * @property {boolean} [supports_structured_output] - Whether the provider supports structured output
+ * @property {boolean} [is_model_author] - True if the provider is the model's author
+ */
 
-/** @type {Array<[string, Partial<ModelInfo>]>} */
-const zaiModels = [
-	["zai-org/GLM-4.6", {
-		parameters: 4.6e9,
-		pricing: { prompt: 0.6, completion: 2.2, input_cache_read: 0.11, input_cache_write: 0, speed: 500 },
-		context_length: 200_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.6",
-		description: "Z.ai GLM-4.6 instruct model"
-	}],
-	["zai-org/GLM-4.6V", {
-		parameters: 4.6e9,
-		pricing: { prompt: 0.3, completion: 0.9, input_cache_read: 0.05, input_cache_write: 0, speed: 600 },
-		context_length: 128_000,
-		architecture: { modality: "text vision" },
-		name: "GLM-4.6V",
-		description: "Vision-enabled GLM-4.6"
-	}],
-	["zai-org/GLM-4.6V-FlashX", {
-		parameters: 4.6e9,
-		pricing: { prompt: 0.04, completion: 0.4, input_cache_read: 0.004, input_cache_write: 0, speed: 800 },
-		context_length: 128_000,
-		architecture: { modality: "text vision" },
-		name: "GLM-4.6V-FlashX",
-		description: "Fast vision GLM variant"
-	}],
-	["zai-org/GLM-4.5", {
-		parameters: 4.5e9,
-		pricing: { prompt: 0.6, completion: 2.2, input_cache_read: 0.11, input_cache_write: 0, speed: 500 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.5",
-		description: "Z.ai GLM-4.5 instruct model"
-	}],
-	["zai-org/GLM-4.5V", {
-		parameters: 4.5e9,
-		pricing: { prompt: 0.6, completion: 1.8, input_cache_read: 0.11, input_cache_write: 0, speed: 500 },
-		context_length: 128_000,
-		architecture: { modality: "text vision" },
-		name: "GLM-4.5V",
-		description: "Vision GLM-4.5"
-	}],
-	["zai-org/GLM-4.5-X", {
-		parameters: 4.5e9,
-		pricing: { prompt: 2.2, completion: 8.9, input_cache_read: 0.45, input_cache_write: 0, speed: 400 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.5-X",
-		description: "Advanced GLM-4.5 variant"
-	}],
-	["zai-org/GLM-4.5-Air", {
-		parameters: 4.5e9,
-		pricing: { prompt: 0.2, completion: 1.1, input_cache_read: 0.03, input_cache_write: 0, speed: 700 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.5-Air",
-		description: "Lightweight GLM-4.5"
-	}],
-	["zai-org/GLM-4.5-AirX", {
-		parameters: 4.5e9,
-		pricing: { prompt: 1.1, completion: 4.5, input_cache_read: 0.22, input_cache_write: 0, speed: 600 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.5-AirX",
-		description: "Extended Air variant"
-	}],
-	["zai-org/GLM-4-32B-0414-128K", {
-		parameters: 32e9,
-		pricing: { prompt: 0.1, completion: 0.1, input_cache_read: 0, input_cache_write: 0, speed: 300 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4 32B 128K",
-		description: "Long-context GLM-4"
-	}],
-	["zai-org/GLM-4.6V-Flash", {
-		parameters: 4.6e9,
-		pricing: { prompt: 0, completion: 0, input_cache_read: 0, input_cache_write: 0, speed: 900 },
-		context_length: 128_000,
-		architecture: { modality: "text vision" },
-		name: "GLM-4.6V-Flash (Free)",
-		description: "Free flash vision model"
-	}],
-	["zai-org/GLM-4.5-Flash", {
-		parameters: 4.5e9,
-		pricing: { prompt: 0, completion: 0, input_cache_read: 0, input_cache_write: 0, speed: 900 },
-		context_length: 128_000,
-		architecture: { modality: "text" },
-		name: "GLM-4.5-Flash (Free)",
-		description: "Free flash model"
-	}]
-]
+/**
+ * @typedef {Object} HuggingFaceModelInfo
+ * @property {string} id - Full model identifier (e.g., "zai-org/GLM-4.7")
+ * @property {string} object - Object type, always "model"
+ * @property {number} created - Unix timestamp of creation
+ * @property {string} owned_by - Owner of the model
+ * @property {HuggingFaceArchitecture} architecture - Model architecture description
+ * @property {HuggingFaceProviderInfo[]} providers - Array of provider information objects
+ */
 
 /**
- * Returns static model info for Hugging Face, including subproviders like Cerebras and Z.ai.
- * Each entry is [modelId, config] where config includes pricing per 1M tokens.
- * @returns {{ models: Array<[string, Partial<ModelInfo>]> }} Model pairs for normalization.
+ * @param {HuggingFaceModelInfo[]} models
+ * @returns {ModelInfo[]}
  */
-export default function getHuggingFaceInfo() {
-	return {
-		models: [
-			// Free tier models (provider: "huggingface")
-			...freeModels.map(([id, config]) => [id, { ...config, provider: "huggingface" }]),
-			// Cerebras subprovider models (provider: "huggingface/cerebras")
-			...cerebrasModels.map(([id, config]) => [id, { ...config, provider: "huggingface/cerebras" }]),
-			// Z.ai subprovider models (provider: "huggingface/zai-org")
-			...zaiModels.map(([id, config]) => [id, { ...config, provider: "huggingface/zai-org" }])
-		]
+export function makeFlat(models) {
+	const predefined = getModels()
+	const map = new Map(predefined.models)
+	const result = []
+	for (const model of models) {
+		const pre = map.get(model.id) ?? {}
+		if (!(model.providers && Array.isArray(model.providers))) {
+			console.warn("Incorrect HuggingFace model (missing providers)")
+			continue
+		}
+		for (const opts of model.providers) {
+			const found = (pre.providers ?? []).find(p => p.provider === opts.provider) ?? {}
+			const pro = "huggingface/" + (opts.provider ?? "")
+			if (pro.endsWith("/")) {
+				console.warn("Incorrect model's provider: " + pro)
+				continue
+			}
+			result.push(new ModelInfo({
+				id: model.id,
+				created: model.created,
+				architecture: new Architecture({
+					input_modalities: model.architecture?.input_modalities,
+					output_modalities: model.architecture?.output_modalities,
+				}),
+				context_length: found.context_length ?? opts.context_length,
+				pricing: new Pricing({
+					prompt: found.pricing?.input ?? opts.pricing?.input ?? -1,
+					completion: found.pricing?.output ??opts.pricing?.output ?? -1,
+				}),
+				provider: "huggingface/" + (found.provider ?? opts.provider),
+				supports_structured_output: (found.supports_structured_output ?? opts.supports_structured_output),
+				supports_tools: (found.supports_structured_output ?? opts.supports_tools),
+				status: (found.status ?? opts.status),
+			}))
+		}
 	}
+	return result
+}
+
+export default {
+	getModels,
+	makeFlat,
 }
diff --git a/src/llm/selectModel.js b/src/llm/selectModel.js
index 5dde4a1..30cbb39 100644
--- a/src/llm/selectModel.js
+++ b/src/llm/selectModel.js
@@ -1,6 +1,7 @@
 import Ui from "../cli/Ui.js"
 import ModelInfo from "./ModelInfo.js"
 import { model2row } from "../cli/autocomplete.js"
+import { DIM, RESET } from "../cli/ANSI.js"
 
 /**
  * Helper to select a model (and optionally its provider) from a list of
@@ -45,6 +46,12 @@ export async function selectModel(models, modelPartial, providerPartial, ui, onS
 		return result
 	}
 
+	const exact = models.get(`${modelPartial}@${providerPartial}`)
+	if (exact) {
+		onSelect(exact)
+		return exact
+	}
+
 	/** @type {Array<ModelInfo>} */
 	let candidates = findCandidates(modelPartial, providerPartial)
 
@@ -56,7 +63,7 @@ export async function selectModel(models, modelPartial, providerPartial, ui, onS
 
 	if (candidates.length === 1) {
 		const chosen = candidates[0]
-		await onSelect(chosen)
+		onSelect(chosen)
 		return chosen
 	}
 	candidates.sort((a, b) => a.id.localeCompare(b.id))
@@ -78,8 +85,8 @@ export async function selectModel(models, modelPartial, providerPartial, ui, onS
 			row.id,
 			row.provider,
 			ui.formats.weight("T", row.context),
-			ui.formats.pricing(row.inputPrice, 2),
-			ui.formats.pricing(row.outputPrice, 2),
+			row.inputPrice < 0 ? `${DIM}empty${RESET}` : ui.formats.pricing(row.inputPrice, 2),
+			row.outputPrice < 0 ? `${DIM}empty${RESET}` : ui.formats.pricing(row.outputPrice, 2),
 		])
 	})
 	ui.console.table(rows, { aligns: ["right", "left", "left", "right", "right", "right"] })
@@ -90,14 +97,14 @@ export async function selectModel(models, modelPartial, providerPartial, ui, onS
 	// Direct id entry?
 	const direct = candidates.find(m => m.id === trimmed)
 	if (direct) {
-		await onSelect(direct)
+		onSelect(direct)
 		return direct
 	}
 
 	const idx = parseInt(trimmed, 10) - 1
 	if (!Number.isNaN(idx) && idx >= 0 && idx < candidates.length) {
 		const chosen = candidates[idx]
-		await onSelect(chosen)
+		onSelect(chosen)
 		return chosen
 	}
 
diff --git a/types/Chat/Options.d.ts b/types/Chat/Options.d.ts
index 2e9cdf6..ba11152 100644
--- a/types/Chat/Options.d.ts
+++ b/types/Chat/Options.d.ts
@@ -28,6 +28,11 @@ export default class ChatOptions {
         help: string;
         default: boolean;
     };
+    static isFix: {
+        alias: string;
+        help: string;
+        default: boolean;
+    };
     static testDir: {
         alias: string;
         default: string;
@@ -65,6 +70,8 @@ export default class ChatOptions {
     isTest: boolean;
     /** @type {boolean} */
     isTiny: boolean;
+    /** @type {boolean} */
+    isFix: boolean;
     /** @type {string} @deprecated Moved to the command test */
     testDir: string;
     /** @type {string} */
diff --git a/types/cli/App.d.ts b/types/cli/App.d.ts
index 1f99b6d..48e1a3b 100644
--- a/types/cli/App.d.ts
+++ b/types/cli/App.d.ts
@@ -66,11 +66,11 @@ export class ChatCLiApp {
     /**
      *
      * @param {number} [step=1]
-     * @returns {Promise<{ shouldContinue: boolean, test: import("../llm/chatSteps.js").TestOutput }>}
+     * @returns {Promise<{ shouldContinue: boolean, test?: import("../cli/testing/node.js").TestOutput }>}
      */
     test(step?: number): Promise<{
         shouldContinue: boolean;
-        test: import("../llm/chatSteps.js").TestOutput;
+        test?: import("../cli/testing/node.js").TestOutput;
     }>;
     /**
      *
diff --git a/types/cli/ModelsOptions.d.ts b/types/cli/ModelsOptions.d.ts
index bb21af7..ad42f80 100644
--- a/types/cli/ModelsOptions.d.ts
+++ b/types/cli/ModelsOptions.d.ts
@@ -3,8 +3,14 @@ export class ModelsOptions {
         help: string;
         default: string;
     };
+    static help: {
+        alias: string;
+        help: string;
+        default: boolean;
+    };
     constructor(input?: {});
     filter: string;
+    help: boolean;
     /**
      * @returns {Array<(model: ModelInfo) => boolean>}
      */
diff --git a/types/cli/Ui.d.ts b/types/cli/Ui.d.ts
index fe059e8..ada1c8d 100644
--- a/types/cli/Ui.d.ts
+++ b/types/cli/Ui.d.ts
@@ -1,4 +1,12 @@
-/** @typedef {"success" | "info" | "warn" | "error" | "debug"} LogTarget */
+/** @typedef {"success" | "info" | "warn" | "error" | "debug" | "log"} LogTarget */
+export class UiStyle {
+    /**
+     * @param {Partial<UiStyle>} input
+     */
+    constructor(input?: Partial<UiStyle>);
+    /** @type {number} */
+    paddingLeft: number;
+}
 export class UiFormats {
     /**
      * Formats weight (size) of the value, available types:
@@ -75,6 +83,21 @@ export class UiConsole {
      * @param {string} prefix
      */
     style(prefix?: string): void;
+    /**
+     * @todo write jsdoc
+     * @param {any[]} args
+     * @returns {{ styles: UiStyle[], args: any[] }}
+     */
+    extractStyles(args?: any[]): {
+        styles: UiStyle[];
+        args: any[];
+    };
+    /**
+     * @todo write jsdoc
+     * @param {any[]} args
+     * @returns {string}
+     */
+    extractMessage(args?: any[]): string;
     /**
      * Output a debug message when debug mode is enabled.
      *
@@ -218,8 +241,17 @@ export class Ui {
         elapsed: number;
         startTime: number;
     }) => void, startTime?: number, fps?: number): NodeJS.Timeout;
+    /**
+     * @todo write jsdoc
+     * @param {Object} options
+     * @param {number} [options.paddingLeft]
+     * @returns {UiStyle}
+     */
+    createStyle(options?: {
+        paddingLeft?: number | undefined;
+    }): UiStyle;
 }
 export default Ui;
-export type LogTarget = "success" | "info" | "warn" | "error" | "debug";
+export type LogTarget = "success" | "info" | "warn" | "error" | "debug" | "log";
 import Alert from "./components/Alert.js";
 import Table from "./components/Table.js";
diff --git a/types/cli/argvHelper.d.ts b/types/cli/argvHelper.d.ts
index 90cb9fa..bbb8b0a 100644
--- a/types/cli/argvHelper.d.ts
+++ b/types/cli/argvHelper.d.ts
@@ -34,6 +34,11 @@ export function parseIO(argv: string[], stdinData: string, fs?: FileSystem, path
  * @returns {T}
  */
 export function parseArgv<T>(argv: string[], Model: new (...args: any) => T): T;
+/**
+ * @param {typeof Object} Model
+ * @returns {string}
+ */
+export function renderHelp(Model: typeof Object): string;
 import FileSystem from "../utils/FileSystem.js";
 import Path from "../utils/Path.js";
 import ReadLine from "../utils/ReadLine.js";
diff --git a/types/cli/selectModel.d.ts b/types/cli/selectModel.d.ts
index 4379d97..df5d2e8 100644
--- a/types/cli/selectModel.d.ts
+++ b/types/cli/selectModel.d.ts
@@ -1,3 +1,8 @@
+/**
+ * @param {import("../llm/ModelInfo.js").default} model
+ * @param {import("./Ui.js").Ui} ui
+ */
+export function showModel(model: import("../llm/ModelInfo.js").default, ui: import("./Ui.js").Ui): void;
 /**
  * Pre-selects a model (loads from cache or defaults). If multiple matches,
  * shows the table and prompts. Persists selection to chat.config.model.
diff --git a/types/cli/testing/node.d.ts b/types/cli/testing/node.d.ts
index 68e5b84..027fab9 100644
--- a/types/cli/testing/node.d.ts
+++ b/types/cli/testing/node.d.ts
@@ -1,12 +1,13 @@
 /**
  * @typedef {Object} TestInfo
- * @property {string} type
+ * @property {"todo" | "fail" | "pass" | "cancelled" | "skip" | "types"} type
  * @property {number} no
  * @property {string} text
  * @property {number} indent
+ * @property {number} [parent]
  * @property {string} [file]
  * @property {object} [doc]
- * @property {[number, number] } [position]
+ * @property {[number, number]} [position]
  *
  * @typedef {Object} TestOutputLogEntry
  * @property {number} i
@@ -43,11 +44,78 @@
  * @returns {TestOutput}
  */
 export function parseOutput(stdout: string, stderr: string, fs?: FileSystem): TestOutput;
+/**
+ * @typedef {Object} TapParseResult
+ * @property {string} [version]
+ * @property {TestInfo[]} tests
+ * @property {Map<number, Error>} errors
+ * @property {Map<number, string>} unknowns
+ * @property {Map<string, number>} counts
+ */
+/**
+ * TAP parser – extracts test‑level information from raw TAP output.
+ */
+export class Tap {
+    /** @param {Partial<Tap>} input */
+    constructor(input: Partial<Tap>);
+    /** @type {string[]} */
+    rows: string[];
+    /** @type {FileSystem} */
+    fs: FileSystem;
+    /** @type {Map<number, string>} rows that are not part of a TAP test */
+    unknowns: Map<number, string>;
+    /** @type {Map<number, Error>} parsing errors */
+    errors: Map<number, Error>;
+    /** @type {Map<string, number>} count of errors by type */
+    counts: Map<string, number>;
+    /** @type {TestInfo[]} */
+    tests: TestInfo[];
+    /**
+     * Walk through all rows and produce a high‑level summary.
+     * @returns {TapParseResult}
+     */
+    parse(): TapParseResult;
+    /**
+     * Collects test information from a subtest block.
+     *
+     * Handles both indented YAML (`---` ...) and non‑indented variants.
+     *
+     * @param {{ i: number, parent?: number }} input
+     * @returns {number} new index (position right after the processed block)
+     */
+    collectTest(input: {
+        i: number;
+        parent?: number;
+    }): number;
+}
+export class DeclarationTS extends Tap {
+    /**
+     *
+     * @param {Object} input
+     * @param {number} input.i
+     * @param {RegExpMatchArray} input.match
+     * @returns {number}
+     */
+    collectTest(input: {
+        i: number;
+        match: RegExpMatchArray;
+    }): number;
+}
+export class Suite extends Tap {
+    /**
+     * @returns {TapParseResult & { tap: TapParseResult, ts: TapParseResult }}
+     */
+    parse(): TapParseResult & {
+        tap: TapParseResult;
+        ts: TapParseResult;
+    };
+}
 export type TestInfo = {
-    type: string;
+    type: "todo" | "fail" | "pass" | "cancelled" | "skip" | "types";
     no: number;
     text: string;
     indent: number;
+    parent?: number | undefined;
     file?: string | undefined;
     doc?: object;
     position?: [number, number] | undefined;
@@ -86,4 +154,11 @@ export type TestOutput = {
     tests: TestInfo[];
     guess: TestOutputCounts;
 };
+export type TapParseResult = {
+    version?: string | undefined;
+    tests: TestInfo[];
+    errors: Map<number, Error>;
+    unknowns: Map<number, string>;
+    counts: Map<string, number>;
+};
 import FileSystem from "../../utils/FileSystem.js";
diff --git a/types/llm/AI.d.ts b/types/llm/AI.d.ts
index c71fb39..9fbf996 100644
--- a/types/llm/AI.d.ts
+++ b/types/llm/AI.d.ts
@@ -7,6 +7,22 @@
  * @property {()=>void} [onFinish] called when the stream ends successfully
  * @property {()=>void} [onAbort] called when the stream is aborted
  */
+export class AiStrategy {
+    /**
+     * @param {ModelInfo} model
+     * @param {number} tokens
+     * @param {number} [safeAnswerTokens=1_000]
+     * @returns {boolean}
+     */
+    shouldChangeModel(model: ModelInfo, tokens: number, safeAnswerTokens?: number): boolean;
+    /**
+     * @param {Map<string, ModelInfo>} models
+     * @param {number} tokens
+     * @param {number} [safeAnswerTokens=1_000]
+     * @returns {ModelInfo | undefined}
+     */
+    findModel(models: Map<string, ModelInfo>, tokens: number, safeAnswerTokens?: number): ModelInfo | undefined;
+}
 /**
  * Wrapper for AI providers.
  *
@@ -21,13 +37,16 @@ export default class AI {
      * @param {Object} input
      * @param {readonly[string, ModelInfo] | readonly [string, ModelInfo] | Map<string, ModelInfo | ModelInfo>} [input.models=[]]
      * @param {ModelInfo} [input.selectedModel]
+     * @param {AiStrategy} [input.strategy]
      */
     constructor(input?: {
         models?: Map<string, ModelInfo> | readonly [string, ModelInfo] | undefined;
         selectedModel?: ModelInfo | undefined;
+        strategy?: AiStrategy | undefined;
     });
     /** @type {ModelInfo?} */
     selectedModel: ModelInfo | null;
+    strategy: AiStrategy;
     /**
      * Flatten and normalize models to Map<string, ModelInfo[]>. Handles:
      * - Map: Pass-through.
@@ -105,8 +124,8 @@ export default class AI {
      * Stream text from a model.
      *
      * The method forwards the call to `ai.streamText` while providing a set of
-     * optional hooks that can be used by callers to monitor or control the
-     * streaming lifecycle.
+     * optional hooks that can be used by monitor or control the streaming
+     * lifecycle.
      *
      * @param {ModelInfo} model
      * @param {import('ai').ModelMessage[]} messages
@@ -125,6 +144,14 @@ export default class AI {
         text: string;
         usage: Usage;
     }>;
+    /**
+     * @throws {Error} When no correspondent model found.
+     * @param {ModelInfo} model
+     * @param {number} tokens
+     * @param {number} [safeAnswerTokens=1_000]
+     * @returns {ModelInfo | undefined}
+     */
+    ensureModel(model: ModelInfo, tokens: number, safeAnswerTokens?: number): ModelInfo | undefined;
     #private;
 }
 /**
diff --git a/types/llm/Architecture.d.ts b/types/llm/Architecture.d.ts
index 3720a78..c0d2aaf 100644
--- a/types/llm/Architecture.d.ts
+++ b/types/llm/Architecture.d.ts
@@ -1,12 +1,5 @@
 /**
  * Represents model architecture information.
- * @typedef {Object} Architecture
- * @property {string[]} input_modalities - Input modalities supported by the model
- * @property {string} instruct_type - Instruct type
- * @property {string} modality - Model modality
- * @property {string[]} output_modalities - Output modalities supported by the model
- * @property {string} tokenizer - Tokenizer type
- * @property {number} [context_length] - Context length (if not in main)
  */
 export default class Architecture {
     /**
@@ -26,32 +19,3 @@ export default class Architecture {
     /** @type {number} */
     context_length: number;
 }
-/**
- * Represents model architecture information.
- */
-export type Architecture = {
-    /**
-     * - Input modalities supported by the model
-     */
-    input_modalities: string[];
-    /**
-     * - Instruct type
-     */
-    instruct_type: string;
-    /**
-     * - Model modality
-     */
-    modality: string;
-    /**
-     * - Output modalities supported by the model
-     */
-    output_modalities: string[];
-    /**
-     * - Tokenizer type
-     */
-    tokenizer: string;
-    /**
-     * - Context length (if not in main)
-     */
-    context_length?: number | undefined;
-};
diff --git a/types/llm/Chat.d.ts b/types/llm/Chat.d.ts
index 28072ac..81a6468 100644
--- a/types/llm/Chat.d.ts
+++ b/types/llm/Chat.d.ts
@@ -8,6 +8,40 @@ export class ChatConfig {
  * Manages chat history and files
  */
 export default class Chat {
+    /** Constants for chat files – single source of truth */
+    static FILES: {
+        input: string;
+        prompt: string;
+        model: string;
+        files: string;
+        inputs: string;
+        response: string;
+        parts: string;
+        stream: string;
+        chunks: string;
+        unknowns: string;
+        answer: string;
+        reason: string;
+        usage: string;
+        fail: string;
+        messages: null;
+    };
+    /**
+     * Reusable path resolution – formats `steps/00X/filename` pattern.
+     * @param {string} path - File name (e.g., "answer.md")
+     * @param {number} [step] - Optional step number (prepended as 00X)
+     * @returns {string}
+     */
+    static formatStepPath(path: string, step?: number): string;
+    /**
+     * Glob split utility for patterns like "src\/**\/*.js".
+     * @param {string} pattern - Glob pattern string
+     * @returns {{ baseDir: string, globPattern: string }}
+     */
+    static splitGlob(pattern: string): {
+        baseDir: string;
+        globPattern: string;
+    };
     /**
      * @param {Partial<Chat>} [input={}]
      */
@@ -118,12 +152,6 @@ export default class Chat {
      * @returns {Promise<Stats>}
      */
     stat(path: string): Promise<Stats>;
-    /**
-     * Save the latest prompt
-     * @param {string} prompt
-     * @returns {Promise<string>} The prompt path.
-     */
-    savePrompt(prompt: string): Promise<string>;
     /**
      * Append to a file
      * @param {string} path
diff --git a/types/llm/ModelInfo.d.ts b/types/llm/ModelInfo.d.ts
index bd7a269..c5f5a25 100644
--- a/types/llm/ModelInfo.d.ts
+++ b/types/llm/ModelInfo.d.ts
@@ -1,12 +1,17 @@
+/**
+ * @typedef {'live'|'staging'} ProviderStatus
+ */
 /**
  * Represents information about a model.
  */
 export default class ModelInfo {
     /**
      * Constructs a ModelInfo instance.
-     * @param {Partial<ModelInfo>} input - Partial object with model properties.
+     * @param {Partial<ModelInfo> & { volume?: number }} input - Partial object with model properties.
      */
-    constructor(input?: Partial<ModelInfo>);
+    constructor(input?: Partial<ModelInfo> & {
+        volume?: number;
+    });
     /** @type {string} - Model ID */
     id: string;
     /** @type {Architecture} - Model architecture */
@@ -45,9 +50,13 @@ export default class ModelInfo {
     supports_structured_output: boolean;
     /** @type {boolean} */
     supportsTools: boolean;
-    /** @type {boolean} */
-    supportsStructuredOutput: boolean;
+    /** @type {ProviderStatus} */
+    status: ProviderStatus;
+    /** @returns {number} The volume of parameters inside model */
+    get volume(): number;
+    #private;
 }
+export type ProviderStatus = "live" | "staging";
 import Architecture from "./Architecture.js";
 import Limits from "./Limits.js";
 import Pricing from "./Pricing.js";
diff --git a/types/llm/ModelProvider.d.ts b/types/llm/ModelProvider.d.ts
index 5f5a87b..cbe3011 100644
--- a/types/llm/ModelProvider.d.ts
+++ b/types/llm/ModelProvider.d.ts
@@ -1,12 +1,44 @@
+/** @typedef {"cerebras" | "openrouter" | "huggingface"} AvailableProvider */
+/**
+ * @typedef {Object} HuggingFaceProviderInfo
+ * @property {string} provider
+ * @property {string} status
+ * @property {number} context_length
+ * @property {{ input: number, output: number }} pricing
+ * @property {boolean} supports_tools
+ * @property {boolean} supports_structured_output
+ * @property {boolean} is_model_author
+*/
+export class CacheConfig {
+    /** @param {Partial<CacheConfig>} [input] */
+    constructor(input?: Partial<CacheConfig>);
+    /** @type {number} Cache duration – 1 hour (in milliseconds) */
+    ttl: number;
+    file: string;
+    /**
+     * @param {string} provider
+     * @return {string}
+     */
+    getFile(provider: string): string;
+    /**
+     * @param {number} time File change time in milliseconds
+     * @param {number} [now] Now time in milliseconds
+     * @returns {boolean}
+     */
+    isAlive(time: number, now?: number): boolean;
+}
 export default class ModelProvider {
+    /** @type {AvailableProvider[]} */
+    static AvailableProviders: AvailableProvider[];
     constructor(input?: {});
     get cachePath(): string;
+    get cacheConfig(): CacheConfig;
     /**
      * Load the cache file if it exists and is fresh.
      * @param {string} provider
-     * @returns {Promise<ModelInfo[] | null>}
+     * @returns {Promise<object[] | null>}
      */
-    loadCache(provider: string): Promise<ModelInfo[] | null>;
+    loadCache(provider: string): Promise<object[] | null>;
     /**
      * Write fresh data to the cache as JSONL (one model per line).
      * @param {any} data
@@ -33,13 +65,13 @@ export default class ModelProvider {
     fetch(url: string | URL | globalThis.Request, options: RequestInit): Promise<Response>;
     /**
      * Flatten multi-provider entries into separate ModelInfo instances.
-     * @param {Array<ModelInfo & { providers?: Partial<ModelInfo> }>} arr
+     * @param {Array<ModelInfo & { providers?: HuggingFaceProviderInfo[] }>} arr
      * @param {AvailableProvider} provider
      * @param {Array<[string, Partial<ModelInfo>]>} [predefined]
      * @returns {ModelInfo[]}
      */
     _makeFlat(arr: Array<ModelInfo & {
-        providers?: Partial<ModelInfo>;
+        providers?: HuggingFaceProviderInfo[];
     }>, provider: AvailableProvider, predefined?: Array<[string, Partial<ModelInfo>]>): ModelInfo[];
     /**
      * Return a map of model-id → array of ModelInfo (one per provider variant).
@@ -61,9 +93,22 @@ export default class ModelProvider {
     /**
      * @param {Array} raw
      * @param {AvailableProvider} name
+     * @returns {}
      */
-    flatten(raw: any[], name: AvailableProvider): ModelInfo[];
+    flatten(raw: any[], name: AvailableProvider): any;
     #private;
 }
 export type AvailableProvider = "cerebras" | "openrouter" | "huggingface";
+export type HuggingFaceProviderInfo = {
+    provider: string;
+    status: string;
+    context_length: number;
+    pricing: {
+        input: number;
+        output: number;
+    };
+    supports_tools: boolean;
+    supports_structured_output: boolean;
+    is_model_author: boolean;
+};
 import ModelInfo from "./ModelInfo.js";
diff --git a/types/llm/Pricing.d.ts b/types/llm/Pricing.d.ts
index 83f5eca..7296455 100644
--- a/types/llm/Pricing.d.ts
+++ b/types/llm/Pricing.d.ts
@@ -3,9 +3,12 @@
  */
 export default class Pricing {
     /**
-     * @param {Partial<Pricing>} input
+     * @param {Partial<Pricing> & { input?: number, output?: number }} options
      */
-    constructor(input?: Partial<Pricing>);
+    constructor(options?: Partial<Pricing> & {
+        input?: number;
+        output?: number;
+    });
     /** @type {number} - Completion cost per million tokens */
     completion: number;
     /** @type {number} - Image cost */
diff --git a/types/llm/chatLoop.d.ts b/types/llm/chatLoop.d.ts
index acf48e5..70a4fe2 100644
--- a/types/llm/chatLoop.d.ts
+++ b/types/llm/chatLoop.d.ts
@@ -33,28 +33,6 @@ export function sendAndStream(options: {
     isTiny?: boolean | undefined;
     fps?: number | undefined;
 }): Promise<sendAndStreamOptions>;
-/**
- * Handles post-stream processing: add to chat, save, unpack and test.
- * @param {Object} input
- * @param {Chat} input.chat
- * @param {Ui} input.ui
- * @param {string} input.answer
- * @param {string} input.reason
- * @param {number} input.step
- * @param {boolean} [input.isYes=false]
- * @returns {Promise<{shouldContinue: boolean, testsCode: string | boolean}>}
- */
-export function postStreamProcess(input: {
-    chat: Chat;
-    ui: Ui;
-    answer: string;
-    reason: string;
-    step: number;
-    isYes?: boolean | undefined;
-}): Promise<{
-    shouldContinue: boolean;
-    testsCode: string | boolean;
-}>;
 export type sendAndStreamOptions = {
     answer: string;
     reason: string;
diff --git a/types/llm/chatSteps.d.ts b/types/llm/chatSteps.d.ts
index 5417951..e5259a8 100644
--- a/types/llm/chatSteps.d.ts
+++ b/types/llm/chatSteps.d.ts
@@ -102,32 +102,65 @@ export function decodeAnswer({ ui, chat, options, logs }: {
  * @param {Chat} param0.chat
  * @param {Function} param0.runCommand
  * @param {number} [param0.step=1]
+ * @param {(chunk) => void} [param0.onData]
  * @returns {Promise<import('../cli/runCommand.js').runCommandResult & { parsed: TestOutput }>}
  */
-export function runTests({ ui, chat, runCommand, step }: {
+export function runTests({ ui, chat, runCommand, step, onData }: {
     ui: Ui;
     chat: Chat;
     runCommand: Function;
     step?: number | undefined;
+    onData?: ((chunk: any) => void) | undefined;
 }): Promise<import("../cli/runCommand.js").runCommandResult & {
     parsed: TestOutput;
 }>;
+/**
+ *
+ * @param {import('../cli/testing/node.js').TestInfo[]} tests
+ * @param {Ui} ui
+ * @returns {any[][]}
+ */
+export function renderTests(tests: import("../cli/testing/node.js").TestInfo[], ui?: Ui): any[][];
+/**
+ *
+ * @param {Object} input
+ * @param {Ui} input.ui
+ * @param {"fail" | "skip" | "todo"} [input.type]
+ * @param {import('../cli/testing/node.js').TestInfo[]} [input.tests=[]]
+ * @param {string[]} [input.content=[]]
+ * @returns {Promise<boolean>}
+ */
+export function printAnswer(input: {
+    ui: Ui;
+    type?: "fail" | "skip" | "todo" | undefined;
+    tests?: import("../cli/testing/node.js").TestInfo[] | undefined;
+    content?: string[] | undefined;
+}): Promise<boolean>;
 /**
  * Decode the answer markdown, unpack if confirmed, run tests, parse results,
  * and ask user for continuation to continue fixing failed, cancelled, skipped, todo
  * tests, if they are.
  *
- * @param {import("../cli/Ui.js").default} ui User interface instance
- * @param {Chat} chat Chat instance (used for paths)
- * @param {import('../cli/runCommand.js').runCommandFn} runCommand Function to execute shell commands
- * @param {ChatOptions} options Always yes to user prompts
- * @param {number} [step] Optional step number for per-step files
- * @returns {Promise<{testsCode: boolean, shouldContinue: boolean, test: TestOutput}>}
+ * @param {Object} input
+ * @param {import("../cli/Ui.js").default} input.ui User interface instance
+ * @param {FileSystem} [input.fs]
+ * @param {Chat} input.chat Chat instance (used for paths)
+ * @param {import('../cli/runCommand.js').runCommandFn} input.runCommand Function to execute shell commands
+ * @param {ChatOptions} input.options Always yes to user prompts
+ * @param {number} [input.step] Optional step number for per-step files
+ * @returns {Promise<{testsCode?: boolean, shouldContinue: boolean, test?: import('../cli/testing/node.js').TapParseResult}>}
  */
-export function decodeAnswerAndRunTests(ui: import("../cli/Ui.js").default, chat: Chat, runCommand: import("../cli/runCommand.js").runCommandFn, options: ChatOptions, step?: number): Promise<{
-    testsCode: boolean;
+export function decodeAnswerAndRunTests(input: {
+    ui: import("../cli/Ui.js").default;
+    fs?: FileSystem | undefined;
+    chat: Chat;
+    runCommand: import("../cli/runCommand.js").runCommandFn;
+    options: ChatOptions;
+    step?: number | undefined;
+}): Promise<{
+    testsCode?: boolean;
     shouldContinue: boolean;
-    test: TestOutput;
+    test?: import("../cli/testing/node.js").TapParseResult;
 }>;
 import FileSystem from "../utils/FileSystem.js";
 import Ui from "../cli/Ui.js";
diff --git a/types/llm/providers/cerebras.info.d.ts b/types/llm/providers/cerebras.info.d.ts
index f68aee8..eeaf123 100644
--- a/types/llm/providers/cerebras.info.d.ts
+++ b/types/llm/providers/cerebras.info.d.ts
@@ -1 +1,10 @@
-export default function getInfo(plan?: string): {};
+/**
+ * @param {object[]} models
+ * @returns {ModelInfo[]}
+ */
+export function makeFlat(models: object[]): ModelInfo[];
+declare namespace _default {
+    export { makeFlat };
+}
+export default _default;
+import ModelInfo from "../ModelInfo.js";
diff --git a/types/llm/providers/huggingface.info.d.ts b/types/llm/providers/huggingface.info.d.ts
index 1fbfe6e..40452f7 100644
--- a/types/llm/providers/huggingface.info.d.ts
+++ b/types/llm/providers/huggingface.info.d.ts
@@ -1,9 +1,122 @@
 /**
- * Returns static model info for Hugging Face, including subproviders like Cerebras and Z.ai.
- * Each entry is [modelId, config] where config includes pricing per 1M tokens.
- * @returns {{ models: Array<[string, Partial<ModelInfo>]> }} Model pairs for normalization.
+ * @returns {{ models: readonly Array<[string, object]> }}
  */
-export default function getHuggingFaceInfo(): {
-    models: Array<[string, Partial<ModelInfo>]>;
+export function getModels(): {
+    models: readonly Array<[string, object]>;
+};
+/**
+ * @typedef {Object} HuggingFaceArchitecture
+ * @property {string[]} input_modalities - List of input modalities (e.g., ["text"], ["text","image"])
+ * @property {string[]} output_modalities - List of output modalities (e.g., ["text"])
+ */
+/**
+ * @typedef {Object} HuggingFacePricing
+ * @property {number} input - Price per input token (or unit) in USD
+ * @property {number} output - Price per output token (or unit) in USD
+ */
+/**
+ * @typedef {Object} HuggingFaceProviderInfo
+ * @property {string} provider - Provider identifier (e.g., "novita", "zai-org")
+ * @property {import("../ModelInfo.js").ProviderStatus} status - Provider status (e.g., "live", "staging")
+ * @property {number} [context_length] - Maximum context length supported by the provider
+ * @property {HuggingFacePricing} [pricing] - Pricing details, if available
+ * @property {boolean} [supports_tools] - Whether the provider supports tool usage
+ * @property {boolean} [supports_structured_output] - Whether the provider supports structured output
+ * @property {boolean} [is_model_author] - True if the provider is the model's author
+ */
+/**
+ * @typedef {Object} HuggingFaceModelInfo
+ * @property {string} id - Full model identifier (e.g., "zai-org/GLM-4.7")
+ * @property {string} object - Object type, always "model"
+ * @property {number} created - Unix timestamp of creation
+ * @property {string} owned_by - Owner of the model
+ * @property {HuggingFaceArchitecture} architecture - Model architecture description
+ * @property {HuggingFaceProviderInfo[]} providers - Array of provider information objects
+ */
+/**
+ * @param {HuggingFaceModelInfo[]} models
+ * @returns {ModelInfo[]}
+ */
+export function makeFlat(models: HuggingFaceModelInfo[]): ModelInfo[];
+declare namespace _default {
+    export { getModels };
+    export { makeFlat };
+}
+export default _default;
+export type HuggingFaceArchitecture = {
+    /**
+     * - List of input modalities (e.g., ["text"], ["text","image"])
+     */
+    input_modalities: string[];
+    /**
+     * - List of output modalities (e.g., ["text"])
+     */
+    output_modalities: string[];
+};
+export type HuggingFacePricing = {
+    /**
+     * - Price per input token (or unit) in USD
+     */
+    input: number;
+    /**
+     * - Price per output token (or unit) in USD
+     */
+    output: number;
+};
+export type HuggingFaceProviderInfo = {
+    /**
+     * - Provider identifier (e.g., "novita", "zai-org")
+     */
+    provider: string;
+    /**
+     * - Provider status (e.g., "live", "staging")
+     */
+    status: import("../ModelInfo.js").ProviderStatus;
+    /**
+     * - Maximum context length supported by the provider
+     */
+    context_length?: number | undefined;
+    /**
+     * - Pricing details, if available
+     */
+    pricing?: HuggingFacePricing | undefined;
+    /**
+     * - Whether the provider supports tool usage
+     */
+    supports_tools?: boolean | undefined;
+    /**
+     * - Whether the provider supports structured output
+     */
+    supports_structured_output?: boolean | undefined;
+    /**
+     * - True if the provider is the model's author
+     */
+    is_model_author?: boolean | undefined;
+};
+export type HuggingFaceModelInfo = {
+    /**
+     * - Full model identifier (e.g., "zai-org/GLM-4.7")
+     */
+    id: string;
+    /**
+     * - Object type, always "model"
+     */
+    object: string;
+    /**
+     * - Unix timestamp of creation
+     */
+    created: number;
+    /**
+     * - Owner of the model
+     */
+    owned_by: string;
+    /**
+     * - Model architecture description
+     */
+    architecture: HuggingFaceArchitecture;
+    /**
+     * - Array of provider information objects
+     */
+    providers: HuggingFaceProviderInfo[];
 };
 import ModelInfo from "../ModelInfo.js";
```

Проаналізуй зміни і напиши коротко англійською мовою commit message, який пізніше буде використовуватись у changelog.

- [](bin/**)
- [](src/**)
- [](releases/1/v1.0.0/**)
- [](features.md)
- [](package.json)
