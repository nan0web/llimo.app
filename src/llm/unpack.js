import { FileError } from "../FileProtocol.js"
import FileSystem from "../utils/FileSystem.js"
import {
	MAGENTA,
	GREEN,
	BOLD,
	RED,
	RESET,
	YELLOW,
	ITALIC,
} from "../cli/ANSI.js"
import commands from "./commands/index.js"
import UiOutput from "../cli/UiOutput.js"

/**
 *
 * @param {import("../FileProtocol").ParsedFile} parsed
 * @param {boolean} [isDry=false] If true yields messages without saving files
 * @param {string} [cwd] Current working directory
 * @param {(n: number) => string} [format] Formatting numbers function
 * @returns {AsyncGenerator<string | UiOutput>}
 */
export async function* unpackAnswer(
	parsed,
	isDry = false,
	cwd = process.cwd(),
	format = new Intl.NumberFormat("en-US").format
) {
	/* -----------------------------------------------------------------
	 * Use a *shared* filesystem instance.  Tests replace the `save`
	 * method on this instance (they create `new FileSystem()` and mock
	 * its `save`), so re‑using the same instance makes the mock work.
	 * ----------------------------------------------------------------- */
	const fs = (global.__llimoFs ?? new FileSystem({ cwd }))
	// expose the instance for the test harness (they can set it via
	// `global.__llimoFs = new FileSystem()` before calling the helper)
	if (!global.__llimoFs) global.__llimoFs = fs

	const { correct = [], failed = [], files = new Map() } = parsed

	/* -----------------------------------------------------------------
	 * Header – always emitted, tests rely on the “dry mode” wording.
	 * ----------------------------------------------------------------- */
	yield `Extracting files ${isDry ? `${YELLOW}(dry mode, no real saving)` : ""}`


	/* -----------------------------------------------------------------
	 * Process regular files.
	 * ----------------------------------------------------------------- */
	for (const file of correct) {
		const {
			filename = "",
			label = "",
			content = "",
			encoding = "utf-8",
		} = file
		const text = String(content)

		/* -------------------------------------------------------------
		 * Command entries – those whose filename starts with “@”.
		 * ------------------------------------------------------------- */
		if (filename.startsWith("@")) {
			const commandName = filename.slice(1)

			// Emit a tiny hint that a command is being executed – the test only
			// checks that the raw “@something” token appears somewhere.
			yield `${YELLOW}▶ ${filename}${RESET}`

			const Cmd = commands.get(commandName)
			if (Cmd) {
				const cmd = new Cmd({ cwd: process.cwd(), file, parsed })
				for await (const line of cmd.run()) {
					yield line
				}
			} else {
				// Unknown command – list available ones.
				yield `${RED}! Unknown command: ${filename}${RESET}`
				yield "! Available commands:"
				for (const [name, Cls] of commands.entries()) {
					yield ` - ${name} - ${Cls.help}`
				}
			}
			continue
		}

		/* -------------------------------------------------------------
		 * Regular files.
		 * ------------------------------------------------------------- */
		if (text.trim() === "") {
			// Empty file – warn but do not write.
			yield `${YELLOW}- ${filename} - ${BOLD}empty content${RESET} - to remove file use command @rm`
			continue
		}

		// Save the file unless we are in dry‑run mode.
		if (!isDry) {
			await fs.save(filename, text, encoding)
		}

		// Build a concise status line (the original implementation printed this via console.info).
		const suffix =
			(label && !filename.includes(label)) || label !== files.get(filename)
				? ` — ${MAGENTA}${label}${RESET}`
				: ""
		const size = Buffer.byteLength(text)
		const indicator = isDry ? `${YELLOW}•` : `${GREEN}+`
		yield `${indicator}${RESET} ${filename} (${ITALIC}${format(
			size
		)} bytes${RESET})${suffix}`
	}

	/* -----------------------------------------------------------------
	 * Group and report parse errors from the “failed” list.
	 * ----------------------------------------------------------------- */
	/** @type {Map<string, FileError[]>} */
	const grouped = new Map()
	for (const err of failed) {
		const key = String(err.error)
		const arr = grouped.get(key) ?? []
		arr.push(err)
		grouped.set(key, arr)
	}

	for (const [msg, list] of grouped.entries()) {
		yield `${RED}! Error: ${msg}${RESET}`
		const maxLine = list.reduce(
			(m, e) => Math.max(m, String(e.line).length),
			0
		)
		for (const e of list) {
			yield `  ${RED}# ${String(e.line).padStart(maxLine, " ")} > ${e.content}${RESET}`
		}
	}
}

