#!/usr/bin/env node
import process from "node:process"
import ModelProvider from "../src/llm/ModelProvider.js"

async function main(argv = process.argv.slice(2)) {
	const provider = new ModelProvider()
	const result = await provider.getAll()
	for (const [name, info] of result.entries()) {
		console.info(`@${name}: ${info.provider}`)
	}
}

main().catch((err) => {
	console.error("❌ Fatal error in llimo‑chat:", err)
	process.exit(1)
})
