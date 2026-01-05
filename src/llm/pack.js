/**
 * Packs files into a single markdown string based on a checklist.
 */
import micromatch from "micromatch"
import { RED, GREEN, RESET, YELLOW, ITALIC, MAGENTA } from "../cli/ANSI.js"
import { FileSystem, Path } from "../utils/index.js"
import { MarkdownProtocol } from "../utils/Markdown.js"

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
 * @param {Object} options
 * @param {string} [options.input] - The markdown string containing the checklist.
 * @param {string} [options.cwd] - The current working directory to resolve files from.
 * @param {(dir: string, entries: string[]) => Promise<void>} [options.onRead] Callback for each directory read.
 * @param {string[]} [options.ignore=[]] An array of directory names to ignore.
 * @returns {Promise<{ text: string, injected: string[], errors: string[] }>} - The generated markdown string with packed files.
 */
export async function packMarkdown(options = {}) {
	const {
		input = "", cwd = process.cwd(), onRead = undefined, ignore = [".git", "node_modules"]
	} = options
	const fs = new FileSystem({ cwd })
	const path = fs.path
	const lines = input.split("\n")
	const output = []
	const injected = []
	const errors = []
	const added = new Set()

	for (const line of lines) {
		const extracted = MarkdownProtocol.extractPath(line)
		if (extracted) {
			const { name, path: relativePath } = extracted
			let params = name.split(";")
			const listOnly = params[0] === "@ls"
			if (listOnly) {
				params = params.slice(1)
			}
			const absPath = path.resolve(relativePath)

			// Handle ignore patterns supplied via a leading “-” in the checklist label.
			params.forEach(word => {
				if (word.startsWith("-")) {
					ignore.push(word.slice(1))
				}
			})

			// Handle glob patterns
			if (relativePath.includes("*")) {
				try {
					// Determine the base directory and the glob pattern.
					const parts = relativePath.split("/")
					let closestDir = "."
					let pattern = relativePath

					for (let i = 0; i < parts.length; i++) {
						if (parts[i].includes("*")) {
							closestDir = parts.slice(0, i).join("/") || "."
							pattern = parts.slice(i).join("/")
							break
						}
					}

					const entries = await fs.browse(closestDir, { recursive: true, onRead, ignore })

					// Keep only files matching the glob.
					const matchedFiles = entries.filter(entry =>
						micromatch.isMatch(entry, pattern, { dot: true })
					)

					matchedFiles.sort()

					for (const file of matchedFiles) {
						if (file.endsWith("/")) continue // skip directories

						const relativeFilePath = closestDir === "." ? file : `${closestDir}/${file}`
						if (added.has(relativeFilePath)) continue
						added.add(relativeFilePath)

						// Build the path relative to the original cwd (e.g. "/var/folders/_2/xxx/src/File.js").
						const filePath = path.resolve(relativeFilePath)

						if (listOnly) {
							output.push(relativeFilePath)
							continue
						}
						try {
							const content = await fs.readFile(filePath, "utf-8")
							const filename = path.basename(file)
							const size = Buffer.byteLength(content)
							const type = path.extname(file).slice(1) || "txt"

							// Use plain size without colour codes.
							injected.push(`  - ${relativeFilePath} ${format(size)} bytes`)
							output.push(`#### [${filename}](${relativeFilePath})`)
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
				// Single file handling
				if (added.has(relativePath)) continue
				try {
					const content = await fs.readFile(absPath, "utf-8")
					const filename = name || path.basename(relativePath)
					const size = Buffer.byteLength(content)
					const type = path.extname(relativePath).slice(1) || "txt"
					injected.push(`  - ${relativePath} ${format(size)} bytes`)
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
			// Preserve non‑checklist lines verbatim.
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
	let input = ""

	// Read from stdin if not a TTY
	if (!process.stdin.isTTY) {
		for await (const chunk of process.stdin) {
			input += chunk
		}
	} else if (argv.length > 0) {
		// Read from file if provided as first argument
		const inputFile = path.resolve(argv[0])
		try {
			input = await fs.readFile(inputFile, "utf-8")
		} catch (/** @type {any} */ error) {
			console.error(`${RED}❌ Cannot read input file: ${error.message}${RESET}`)
			process.exit(1)
		}
	} else {
		console.error(`${RED}❌ No input provided. Pipe markdown to stdin or provide a file path.${RESET}`)
		process.exit(1)
	}

	const outputPath = argv.length > 1 ? path.resolve(argv[1]) : null
	const { text, injected, errors } = await packMarkdown({ input })

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
