#!/usr/bin/env node
import process from "node:process"
import { autocompleteModels } from "../src/cli/autocomplete.js"
import { loadModels } from "../src/Chat/models.js"
import Ui from "../src/cli/Ui.js"

/**
 * CLI entry for model browser
 */
async function main(argv = process.argv.slice(2)) {
	const ui = new Ui({ debugMode: argv.includes("--debug") })
	const modelMap = await loadModels(ui)

	if (!process.stdout.isTTY || argv[0] === ">") {
		// Pipe mode: just output all models
		const allModels = autocompleteModels.modelRows(modelMap)
		autocompleteModels.pipeOutput(allModels)
	} else {
		// Interactive mode
		console.info("Loading models... (press /help for usage)\n")
		await autocompleteModels.interactive(modelMap, ui)
	}
}

main().catch((err) => {
	console.error("❌ Fatal error in llimo-models:", err.message)
	process.exit(1)
})
