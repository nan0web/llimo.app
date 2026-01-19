import yaml from "yaml"
import { FileSystem } from "../utils/FileSystem.js"
import commands from "./commands/index.js"
import loadSystemInstructions from "../templates/system.js"
import ChatOptions from "../Chat/Options.js"

/**
 * Generates the system prompt markdown.
 * @param {string} [outputPath] - Optional path to write the system prompt to.
 * @returns {Promise<string>} - The generated system prompt string.
 */
export async function generateSystemPrompt(outputPath) {
	const fs = new FileSystem()

	const template = await loadSystemInstructions()
	if (!template) {
		throw new Error("Cannot read system template file.")
	}

	const list = Array.from(commands.keys()).join(", ")
	const md = Array.from(commands.values()).map(
		Command => `### ${Command.name}\n${Command.help}\n\n`
			+ `Example:\n#### [${Command.label || ""}](@${Command.name})\n${Command.example}`
	).join("\n\n")

	const output = template
		.replaceAll("<!--TOOLS_LIST-->", list)
		.replaceAll("<!--TOOLS_MD-->", md)

	if (outputPath) {
		await fs.writeFile(outputPath, output)
	}

	return output
}

/**
 * @param {string} content
 * @returns {{ content: string, vars: object }}
 */
export function parseSystemPrompt(content) {
	const rows = content.split("\n")
	const result = { content, vars: {} }
	if ("---" === rows[0]) {
		const next = rows.findIndex((r, i) => i > 0 && "---" === r)
		if (next > 0) {
			result.vars = yaml.parse(rows.slice(1, next).join("\n"))
			result.content = rows.slice(next + 1).join("\n")
		}
	}
	return result
}

/**
 * @param {string[] | Array<{ content: string, vars: object }>} arr
 * @returns {{ head: string, body: string, vars: ChatOptions }}
 */
export function mergeSystemPrompts(arr) {
	const content = []
	let vars = {}
	for (let s of arr) {
		if ("string" === typeof s) s = parseSystemPrompt(s)
		content.push(s.content ?? "")
		vars = Object.assign(vars, s.vars ?? {})
	}
	const head = Object.keys(vars).length ? `---\n${yaml.stringify(vars)}---\n` : ""
	const body = content.join("\n\n---\n\n")
	return { head, body, vars: new ChatOptions(vars) }
}
