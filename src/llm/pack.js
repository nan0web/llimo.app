/**
 * Packs files into a single markdown string based on a checklist.
 */
import micromatch from "micromatch"
import { FileSystem, Path, RED, GREEN, RESET, YELLOW, ITALIC, MAGENTA } from "../utils.js"
import Markdown from "../utils/Markdown.js"

const numberFormat = new Intl.NumberFormat("en-US").format
const format = no => {
	const prefix = no < 1e3 ? GREEN
		: no < 1e4 ? MAGENTA
		: no < 1e5 ? YELLOW
		: RED
	return prefix + numberFormat(no) + RESET
}

/**
 * Packs files into a single markdown string based on a checklist.
 * @param {string} markdownInput - The markdown string containing the checklist.
 * @param {string} [cwd] - The current working directory to resolve files from.
 * @param {(dir: string, entries: string[]) => Promise<void>} [onRead] Callback for each directory read.
 * @param {string[]} [ignore=[]] An array of directory names to ignore.
 * @returns {Promise<{ text: string, injected: string[], errors: string[] }>} - The generated markdown string with packed files.
 */
export async function packMarkdown(
	markdownInput, cwd = process.cwd(), onRead = undefined, ignore = [".git", "node_modules"]
) {
	const fs = new FileSystem({ cwd })
	const path = fs.path
	const lines = markdownInput.split("\n")
	const output = []
	const injected = []
	const errors = []

	for (const line of lines) {
		const extracted = Markdown.extractPath(line)
		if (extracted) {
			const { name, path: relativePath } = extracted
			const listOnly = "@ls" === name
			const absPath = path.resolve(relativePath)

			// Handle glob patterns
			if (relativePath.includes('*') || relativePath.includes('**')) {
				try {
					// Find the closest parent directory
					const parts = relativePath.split('/')
					let closestDir = '.'
					let pattern = relativePath

					// Find the first non-pattern part to use as base directory
					for (let i = 0; i < parts.length; i++) {
						if (parts[i].includes('*') || parts[i].includes('**')) {
							closestDir = parts.slice(0, i).join('/') || '.'
							pattern = parts.slice(i).join('/')
							break
						}
					}

					const entries = await fs.browse(closestDir, { recursive: true, onRead, ignore })

					// Filter entries based on pattern
					const matchedFiles = entries.filter(entry =>
						micromatch.isMatch(entry, pattern, { dot: true })
					)

					// Sort files for consistent output
					matchedFiles.sort()

					// Process each matched file
					for (const file of matchedFiles) {
						if (file.endsWith("/")) continue
						const filePath = path.resolve(closestDir, file)
						if (listOnly) {
							output.push(file)
							continue
						}
						try {
							const content = await fs.readFile(filePath, "utf-8")
							const filename = path.basename(file)
							const size = Buffer.byteLength(content)
							const type = path.extname(file).slice(1) || "txt"

							injected.push(`  - ${file} ${ITALIC}${format(size)} bytes${RESET}`)
							output.push(`#### [${filename}](${filePath})`)
							output.push(`\`\`\`${type}`)
							output.push(content)
							output.push("```")
						} catch (error) {
							errors.push(`${line} -> ${filePath}`)
							output.push(`ERROR: Could not read file ${filePath}`)
						}
					}
				} catch (error) {
					errors.push(line)
					output.push(`ERROR: Could not process pattern ${relativePath}`)
				}
			} else {
				// Handle single file
				try {
					const content = await fs.readFile(absPath, "utf-8")
					const filename = name || path.basename(relativePath)
					const size = Buffer.byteLength(content)
					const type = path.extname(relativePath).slice(1) || "txt"
					injected.push(`${line} ${ITALIC}${format(size)} bytes${RESET}`)
					output.push(`#### [${filename}](${relativePath})`)
					output.push(`\`\`\`${type}`)
					output.push(content)
					output.push("```")
				} catch (error) {
					errors.push(line)
					output.push(`ERROR: Could not read file ${relativePath}`)
				}
			}
		} else {
			// Preserve non-checklist lines verbatim
			output.push(line)
		}
	}

	return { text: output.join("\n"), injected, errors }
}

/**
 * Main function for the CLI script.
 * @param {string[]} argv - Process arguments.
 */
export async function main(argv = process.argv.slice(2)) {
	const fs = new FileSystem()
	const path = new Path()
	let inputData = ""

	// Read from stdin if not a TTY
	if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) {
			inputData += chunk
		}
	} else if (argv.length > 0) {
		// Read from file if provided as first argument
		const inputFile = path.resolve(argv[0])
		try {
			inputData = await fs.readFile(inputFile, "utf-8")
		} catch (/** @type {any} */ error) {
			console.error(`${RED}❌ Cannot read input file: ${error.message}${RESET}`)
			process.exit(1)
		}
	} else {
		console.error(`${RED}❌ No input provided. Pipe markdown to stdin or provide a file path.${RESET}`)
		process.exit(1)
	}

	const outputPath = argv.length > 1 ? path.resolve(argv[1]) : null
	const { text, injected, errors } = await packMarkdown(inputData)

	if (outputPath) {
		await fs.writeFile(outputPath, text)
		const stats = await fs.stat(outputPath)
		console.info(`${GREEN}+${RESET} ${outputPath}`)
		if (injected.length) {
			console.info(`• injected ${injected.length} file(s):\n${injected.join("\n")}`)
		}
		if (errors.length) {
			console.warn(`\n${YELLOW}Unable to read files:\n` + errors.join("\n") + `\n${RESET}`)
		}
		console.info(`Prompt size: ${ITALIC}${format(stats.size)} bytes${RESET} — ${format(injected.length)} file(s).`)

	} else {
		console.info(text)
	}

}
