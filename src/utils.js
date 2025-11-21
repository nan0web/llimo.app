/**
 * Utility functions for llimo-chat
 */
import { ReadStream, WriteStream } from 'node:tty'
import process from 'node:process'

import FileSystem from './utils/FileSystem.js'
import Path from './utils/Path.js'
import ReadLine from './utils/ReadLine.js'

/**
 * Formats milliseconds into a mm:ss.s string.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted time string.
 */
function formatTime(ms) {
	const totalSeconds = ms / 1000
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = (totalSeconds % 60).toFixed(1)
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(4, '0')}`
}

/**
 * Clears the console line to prepare for a new progress update.
 * @param {WriteStream} [stdout=process.stdout]
 */
function clearLine(stdout = process.stdout) {
	stdout.write('\r' + ' '.repeat(stdout.columns || 80) + '\r')
}

// Default instances
const defaultFileSystem = new FileSystem()
const defaultPath = new Path()
const defaultReadLine = new ReadLine()

/**
 * Finds configuration files in current or parent directories.
 * @param {string[]} filenames - Array of filenames to search for.
 * @param {FileSystem} [fileSystem=defaultFileSystem] - FileSystem instance for testing
 * @param {Path} [pathUtil=defaultPath] - Path instance for testing
 * @returns {Promise<Array<{path: string, content: string}>>} Array of found files with their paths and contents.
 */
async function findConfigFiles(filenames, fileSystem = defaultFileSystem, pathUtil = defaultPath) {
	const result = []
	let currentDir = process.cwd()
	const root = process.platform === 'win32' ? currentDir[0] + ':\\' : '\/'
	const visited = new Set()

	do {
		for (const filename of filenames) {
			const filePath = pathUtil.resolve(currentDir, filename)
			if (visited.has(filePath.toLowerCase())) continue
			visited.add(filePath.toLowerCase())
			if (await fileSystem.access(filePath)) {
				const content = await fileSystem.readFile(filePath, 'utf-8')
				result.push({ path: filePath, content })
			}
		}

		const dir = pathUtil.dirname(currentDir)
		if (dir === currentDir) break
		if (currentDir === root) break
		currentDir = dir
	} while (true)

	return result
}

/**
 * Gets the prompt from a file, stdin, or interactive input.
 * @param {string} promptFile - The file to read the prompt from.
 * @param {FileSystem} [fileSystem=defaultFileSystem] - FileSystem instance for testing
 * @param {ReadLine} [readLine=defaultReadLine] - ReadLine instance for testing
 * @param {ReadStream} [stdin] - Mock stdin object for testing
 * @returns {Promise<string>} The prompt text.
 */
async function getPrompt(promptFile, fileSystem = defaultFileSystem, readLine = defaultReadLine, stdin = process.stdin) {
	// 1. Try to read from prompt.md
	if (await fileSystem.access(promptFile)) {
		const content = await fileSystem.readFile(promptFile, 'utf-8')
		if (content.trim()) return content
	}

	// 2. Try to read from stdin only if it's not a TTY (i.e., data is piped)
	if (!stdin.isTTY) {
		let content = ''
		stdin.setEncoding('utf8')

		return new Promise((resolve, reject) => {
			stdin.on('data', (chunk) => {
				content += chunk
			})
			stdin.on('end', () => {
				resolve(content)
			})
			stdin.on('error', reject)
		})
	}

	// 3. Fallback to interactive readline
	const rl = readLine.createInterface({
		input: stdin,
		output: process.stdout,
	})
	return new Promise((resolve) => {
		rl.question('> ', (answer) => {
			rl.close()
			resolve(answer)
		})
	})
}

/**
 * @param {string} str
 * @returns {string}
 */
function normalizeJSONL(str) {
	str = String(str).trim()

	if (str.startsWith("```jsonl\n") && str.endsWith("\n```")) {
		str = str.slice(9, -4)
	}
	return str
}

/**
 * @param {string} str
 * @returns {Array<any | Error>}
 */
function parseJSONL(str) {
	return String(str).split("\n").map((s, index) => {
		try {
			return JSON.parse(s)
		} catch (err) {
			return new Error(`Cannot parse line #${index + 1} (${s.slice(0, 33)}${s.length > 33 ? ".." : ""})`)
		}
	})
}

export * from "./utils/ANSI.js"

export {
	formatTime, clearLine, findConfigFiles, getPrompt,
	normalizeJSONL, parseJSONL,
	FileSystem, Path, ReadLine
}
