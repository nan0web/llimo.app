#!/usr/bin/env node
import { main } from "../src/llm/pack.js"
main().catch(err => {
	console.error("❌ Fatal error in llimo-pack:", err)
	process.exit(1)
})
