#!/usr/bin/env node
import process from "node:process"
import { autocompleteModels } from "../src/cli/autocomplete.js"
import { loadModels } from "../src/Chat/models.js"
import { parseArgv, Ui } from "../src/cli/index.js"
import ModelsOptions from "../src/cli/ModelsOptions.js"
import { renderHelp } from "../src/cli/argvHelper.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

/**
 * CLI entry for model browser
 */
export async function main(argv = process.argv.slice(2)) {
	const options = parseArgv(argv, ModelsOptions)

	if (options.help) {
		ui.console.info(renderHelp(ModelsOptions))
		process.exit(0)
	}

	const modelMap = await loadModels({ ui, noCache: options.noCache })
	// Filter handling – apply and exit if filter provided
	if (options.filter) {
		const predicates = options.getFilters()
		const filtered = new Map()
		for (const [id, model] of modelMap.entries()) {
			if (predicates.every((fn) => fn(model))) {
				filtered.set(id, model)
			}
		}
		const rows = autocompleteModels.modelRows(filtered)
		autocompleteModels.pipeOutput(rows, ui)
		// Exit after filtering (non-interactive)
		process.exit(0)
	}

	if (!process.stdout.isTTY || argv[0] === ">") {
		// Pipe mode: just output all models
		const allModels = autocompleteModels.modelRows(modelMap)
		autocompleteModels.pipeOutput(allModels, ui)
	} else {
		// Interactive mode
		ui.console.info("Loading models... (press /help for usage)\n")
		await autocompleteModels.interactive(modelMap, ui)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	})
}
