#!/usr/bin/env node
/*
 * llimo-chat.js - Interactive AI chat with file packing, cost tracking, and git integration
 * 
 * Features:
 * - Multiple AI providers (Cerebras, HuggingFace, OpenRouter)
 * - Streaming chat with progress display
 * - Cost calculation and tracking
 * - Git branch management
 * - Automatic testing and iteration
 */

import { fileURLToPath } from "node:url"
import process from "node:process"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { ReadLine } from "../src/utils/ReadLine.js"
import { FileSystem, Path, GREEN, YELLOW, RED, RESET, ITALIC, BOLD, CYAN } from "../src/utils.js"
import { createOpenAI } from '@ai-sdk/openai'
import { createCerebras } from '@ai-sdk/cerebras'
import { createHuggingFace } from '@ai-sdk/huggingface'
import { streamText, generateText } from 'ai'
import Markdown from "../src/utils/Markdown.js"

// AI Provider configurations
const PROVIDERS = {
	cerebras: {
		create: () => createCerebras({ apiKey: process.env.CEREBRAS_API_KEY }),
		models: async () => ['gpt-oss-120b'],
		defaultModel: 'gpt-oss-120b',
		costs: { input: 0.20, output: 0.80, cache: 0.10 } // per 1M tokens
	},
	huggingface: {
		create: () => createHuggingFace({ apiKey: process.env.HUGGINGFACE_API_KEY }),
		models: async () => ['meta-llama/Llama-3.1-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
		defaultModel: 'meta-llama/Llama-3.1-70B-Instruct',
		costs: { input: 0.15, output: 0.60, cache: 0.08 }
	},
	openrouter: {
		create: () => createOpenAI({ 
			apiKey: process.env.OPENROUTER_API_KEY,
			baseURL: "https://openrouter.ai/api/v1"
		}),
		models: async () => ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5'],
		defaultModel: 'anthropic/claude-3.5-sonnet',
		costs: { input: 0.30, output: 1.20, cache: 0.15 }
	}
}

class ChatSession {
	constructor(chatId, provider = 'cerebras') {
		this.id = chatId
		this.provider = provider
		this.messages = []
		this.totalCost = 0
		this.errorCount = 0
		this.fs = new FileSystem()
		this.path = new Path()
		this.chatDir = this.path.resolve('chat', chatId)
		this.messagesFile = this.path.join(this.chatDir, 'messages.jsonl')
		this.promptFile = this.path.join(this.chatDir, 'prompt.md')
		this.thinkFile = this.path.join(this.chatDir, 'think.md')
		this.answerFile = this.path.join(this.chatDir, 'answer.md')
	}

	async init() {
		await this.fs.mkdir(this.chatDir, { recursive: true })
		
		// Load existing messages if any
		try {
			const content = await this.fs.readFile(this.messagesFile, 'utf-8')
			this.messages = content.split('\n')
				.filter(line => line.trim())
				.map(line => JSON.parse(line))
		} catch {
			this.messages = []
		}
	}

	async addMessage(role, content, usage = {}) {
		const message = {
			role,
			content,
			timestamp: new Date().toISOString(),
			usage,
			cost: this.calculateCost(usage)
		}
		
		this.messages.push(message)
		this.totalCost += message.cost
		
		// Save to file
		const line = JSON.stringify(message) + '\n'
		await this.fs.appendFile(this.messagesFile, line, 'utf-8')
		
		return message
	}

	calculateCost(usage) {
		const provider = PROVIDERS[this.provider]
		if (!provider || !usage) return 0
		
		const inputCost = (usage.promptTokens || 0) / 1000000 * provider.costs.input
		const outputCost = (usage.completionTokens || 0) / 1000000 * provider.costs.output
		const cacheCost = (usage.cacheTokens || 0) / 1000000 * (provider.costs.cache || 0)
		
		return inputCost + outputCost + cacheCost
	}

	async savePrompt(content) {
		await this.fs.writeFile(this.promptFile, content, 'utf-8')
	}

	async saveThink(content) {
		await this.fs.writeFile(this.thinkFile, content, 'utf-8')
	}

	async saveAnswer(content) {
		await this.fs.writeFile(this.answerFile, content, 'utf-8')
	}
}

class ProgressDisplay {
	constructor(fps = 30) {
		this.fps = fps
		this.interval = 1000 / fps
		this.startTime = Date.now()
		this.lastUpdate = 0
		this.tokens = 0
		this.thinkingTokens = 0
		this.writingTokens = 0
		this.cost = 0
		this.cacheCost = 0
		this.isThinking = false
	}

	update(tokens, thinking = false, writing = false) {
		const now = Date.now()
		if (now - this.lastUpdate >= this.interval) {
			this.tokens += tokens
			if (thinking) this.thinkingTokens += tokens
			if (writing) this.writingTokens += tokens
			this.lastUpdate = now
			this.render()
		}
	}

	render() {
		const elapsed = (Date.now() - this.startTime) / 1000
		const speed = Math.round(this.tokens / elapsed)
		const format = (n) => new Intl.NumberFormat().format(n)
		
		console.clear()
		console.log(`                tokens  | speed    | time   | cost`)
		console.log(`chat progress → ${format(this.tokens)}T | ${format(speed)}T/s | ${elapsed.toFixed(3)}s | $${this.cost.toFixed(3)}`)
		
		if (this.thinkingTokens > 0) {
			const thinkingSpeed = Math.round(this.thinkingTokens / elapsed)
			console.log(`     thinking ← ${format(this.thinkingTokens)}T | ${format(thinkingSpeed)}T/s | ${elapsed.toFixed(3)}s | $${(this.thinkingTokens / 1000000 * 0.20).toFixed(3)}`)
		}
		
		if (this.writingTokens > 0) {
			const writingSpeed = Math.round(this.writingTokens / elapsed)
			console.log(`     writing  ← ${format(this.writingTokens)}T | ${format(writingSpeed)}T/s | ${elapsed.toFixed(3)}s | $${(this.writingTokens / 1000000 * 0.20).toFixed(3)}`)
		}
		
		const total = this.tokens + this.thinkingTokens + this.writingTokens
		const totalSpeed = Math.round(total / elapsed)
		console.log(`     total      ${format(total)}T | ${format(totalSpeed)}T/s | ${elapsed.toFixed(3)}s | $${this.cost.toFixed(3)}`)
		
		if (this.cacheCost > 0) {
			console.log(`      cache    - $${this.cacheCost.toFixed(3)} (50% discount)`)
		}
	}
}

async function runCommand(cmd, args = [], cwd = process.cwd()) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: 'pipe' })
		let stdout = ''
		let stderr = ''
		
		child.stdout.on('data', data => stdout += data)
		child.stderr.on('data', data => stderr += data)
		
		child.on('close', code => {
			resolve({ stdout, stderr, exitCode: code })
		})
		
		child.on('error', reject)
	})
}

async function createGitBranch(branchName) {
	try {
		await runCommand('git', ['checkout', '-b', branchName])
		await runCommand('git', ['add', '.'])
		await runCommand('git', ['commit', '-m', `feat: start ${branchName}`])
		console.log(`${GREEN}+${RESET} Created git branch ${BOLD}${branchName}${RESET}`)
	} catch (error) {
		console.warn(`${YELLOW}!${RESET} Git branch creation failed: ${error.message}`)
	}
}

async function commitGit(message) {
	try {
		await runCommand('git', ['add', '.'])
		await runCommand('git', ['commit', '-m', message])
	} catch (error) {
		console.warn(`${YELLOW}!${RESET} Git commit failed: ${error.message}`)
	}
}

async function moveGitBranch(from, to) {
	try {
		await runCommand('git', ['branch', '-m', from, to])
		await runCommand('git', ['push', 'origin', to])
		console.log(`${GREEN}+${RESET} Moved branch to ${BOLD}${to}${RESET}`)
	} catch (error) {
		console.warn(`${YELLOW}!${RESET} Git branch move failed: ${error.message}`)
	}
}

async function runTests() {
	console.log(`\n${CYAN}running tests${RESET}`)
	
	// Run regular tests
	const testResult = await runCommand('pnpm', ['test'])
	console.log(testResult.stdout)
	if (testResult.stderr) console.log(testResult.stderr)
	
	if (testResult.exitCode !== 0) {
		console.log(`\n${RED}✖ failing tests:${RESET}\n`)
		return false
	}
	
	// Run build
	const buildResult = await runCommand('pnpm', ['build'])
	if (buildResult.exitCode !== 0) {
		console.log(`${RED}Build failed${RESET}`)
		console.log(buildResult.stdout)
		if (buildResult.stderr) console.log(buildResult.stderr)
		return false
	}
	
	console.log(`\n${GREEN}All tests passed, no typed mistakes.${RESET}`)
	return true
}

async function getProviderModels(provider) {
	const config = PROVIDERS[provider]
	if (!config) return []
	
	try {
		return await config.models()
	} catch {
		return [config.defaultModel]
	}
}

async function main(argv = process.argv.slice(2)) {
	const rl = new ReadLine()
	const fs = new FileSystem()
	const path = new Path()
	
	// Parse arguments
	let inputFile = null
	let provider = 'cerebras'
	
	for (const arg of argv) {
		if (arg.startsWith('--provider=')) {
			provider = arg.split('=')[1]
		} else if (!arg.startsWith('-') && !inputFile) {
			inputFile = arg
		}
	}
	
	// Validate provider
	if (!PROVIDERS[provider]) {
		console.error(`${RED}Error:${RESET} Unknown provider ${provider}. Available: ${Object.keys(PROVIDERS).join(', ')}`)
		process.exit(1)
	}
	
	// Get input
	let inputContent = ''
	if (inputFile) {
		try {
			inputContent = await fs.readFile(inputFile, 'utf-8')
			console.log(`preparing ${inputFile} (${path.resolve(inputFile)})`)
		} catch (error) {
			console.error(`${RED}Error:${RESET} Cannot read input file: ${error.message}`)
			process.exit(1)
		}
	} else if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) {
			inputContent += chunk
		}
	} else {
		inputContent = await rl.interactive({
			question: 'Enter your prompt (Ctrl+D to finish):\n',
			stopKeys: ['ctrl']
		})
	}
	
	// Create chat session
	const chatId = randomUUID().slice(0, 8)
	const session = new ChatSession(chatId, provider)
	await session.init()
	
	console.log(`no chat history found, creating new chat (${chatId})`)
	
	// Copy input file to chat if provided
	if (inputFile) {
		const chatInputFile = path.join(session.chatDir, path.basename(inputFile))
		await fs.writeFile(chatInputFile, inputContent, 'utf-8')
		console.log(`+ ${path.basename(inputFile)} (${chatInputFile})`)
		console.log(`  copied to chat session`)
	}
	
	// Pack the input file
	const packResult = await runCommand('node', [
		'bin/llimo-pack.js',
		inputFile ? path.join('chat', chatId, path.basename(inputFile)) : '-',
		path.join('chat', chatId, 'prompt.md')
	], process.cwd(), inputFile ? null : inputContent)
	
	console.log(packResult.stdout)
	
	// Create git branch
	const branchName = `2511/llimo-chat`
	await createGitBranch(branchName)
	
	// Main chat loop
	let step = 1
	while (true) {
		const timestamp = new Date().toISOString()
		console.log(`\nstep ${step}. ${timestamp}`)
		
		// Get prompt content
		const promptContent = await fs.readFile(session.promptFile, 'utf-8')
		
		// Initialize AI provider
		const providerConfig = PROVIDERS[provider]
		const ai = providerConfig.create()
		const models = await getProviderModels(provider)
		const model = models[0]
		
		console.log(`\nsending prompt to API (streaming)`)
		console.log(`model [${model}](@${provider}) → $${providerConfig.costs.input}/MT ← $${providerConfig.costs.output}/MT (cache - $${providerConfig.costs.cache}/MT)`)
		console.log(`\n! batch processing has 50% discount comparing to streaming\n`)
		
		// Stream response
		const progress = new ProgressDisplay()
		let response = ''
		let usage = { promptTokens: 0, completionTokens: 0 }
		
		try {
			const stream = await streamText({
				model: ai(model),
				messages: [{ role: 'user', content: promptContent }],
			})
			
			for await (const delta of stream.textStream) {
				response += delta
				progress.update(delta.length, false, true)
			}
			
			usage = await stream.usage
			progress.cost = session.calculateCost(usage)
			progress.render()
			
		} catch (error) {
			console.error(`${RED}Error:${RESET} AI request failed: ${error.message}`)
			session.errorCount++
			
			if (session.errorCount >= 3) {
				console.log(`${RED}Too many errors, stopping.${RESET}`)
				await moveGitBranch(branchName, `2511-fail/llimo-chat`)
				break
			}
			
			await commitGit(`chat: step ${step} failed`)
			step++
			continue
		}
		
		// Save response
		await session.saveAnswer(response)
		await session.addMessage('assistant', response, usage)
		
		console.log(`\n+ think.md (${session.thinkFile})`)
		console.log(`  Think size: ${(usage.promptTokens * 4).toLocaleString()} bytes (${usage.promptTokens}T)`)
		console.log(`+ answer.md (${session.answerFile})`)
		console.log(`  Answer size: ${(usage.completionTokens * 4).toLocaleString()} bytes (${usage.completionTokens}T)`)
		
		// Decode and execute response
		console.log(`\ndecoding answer`)
		const promptMd = await fs.readFile(session.promptFile, 'utf-8')
		const newPrompt = promptMd + '\n```bash\n# > chat/${chatId}/prompt.md\nnode bin/llimo-unpack.js chat/${chatId}/answer.md # >> chat/${chatId}/prompt.md 2>&1\n'
		
		const unpackResult = await runCommand('node', [
			'bin/llimo-unpack.js',
			session.answerFile
		], process.cwd())
		
		newPrompt += unpackResult.stdout + '\n```\n'
		await session.savePrompt(newPrompt)
		console.log(unpackResult.stdout)
		
		// Run tests
		const testsPassed = await runTests()
		
		if (testsPassed) {
			await moveGitBranch(branchName, `2511-done/llimo-chat`)
			console.log(`\n${GREEN}✓ Task completed successfully!${RESET}`)
			break
		}
		
		await commitGit(`chat: step ${step} completed`)
		step++
		
		if (step > 10) {
			console.log(`${YELLOW}Maximum steps reached, stopping.${RESET}`)
			await moveGitBranch(branchName, `2511-fail/llimo-chat`)
			break
		}
	}
}

main().catch(err => {
	console.error("❌ Fatal error in llimo‑chat:", err)
	process.exit(1)
})
