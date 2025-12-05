import ReadLine from "../../src/utils/ReadLine.js"

async function main() {
	const rl = new ReadLine()

	// Example 1: stop on a *stop word* only
	const answer1 = await rl.interactive({
		question: "What is your name?",
		help: true,
		stopWord: "#",               // type # on a line by itself to finish
		stopKeys: [],                // no special key combos
	})
	console.info('\n▶️  Result (stop‑word only):', answer1)

	// Example 2: stop on **plain Enter** (no stop word)
	const answer2 = await rl.interactive({
		question: "One‑line reply (press Enter to finish)",
		help: true,
		stopWord: "",                // empty → never triggers
		stopKeys: "enter",           // plain Enter ends input
	})
	console.info('\n▶️  Result (plain Enter):', answer2)

	// Example 3: stop on **Ctrl‑Enter** (or Cmd‑Enter on macOS)
	const answer3 = await rl.interactive({
		question: "Write a paragraph, then finish with Ctrl‑Enter (or ⌘‑Enter)",
		help: true,
		stopWord: "",                // empty → never triggers
		stopKeys: ["ctrl", "meta"],  // accept either Ctrl+Enter or Cmd+Enter
	})
	console.info('\n▶️  Result (Ctrl/Cmd‑Enter):', answer3)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
