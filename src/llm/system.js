import { FileSystem } from "../utils.js"
import commands from "./commands/index.js"
import loadSystemInstructions from "../templates/system.js"

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
