import LanguageModelUsage from "./LanguageModelUsage.js"
import ModelInfo from "./ModelInfo.js"

/**
 * Helper for generating the chat‑progress lines shown during streaming.
 *
 * The function is a pure formatter – it receives runtime data and returns
 * ready‑to‑print strings.  It is unit‑tested in `chatProgress.test.js`.
 *
 * @typedef {Object} ChatProgressInput
 * @property {LanguageModelUsage} usage
 * @property {{ startTime: number, reasonTime?: number, answerTime?: number }} clock
 * @property {ModelInfo} model
 * @property {(n:number)=>string} [format]     number formatter (e.g. Intl.NumberFormat)
 * @property {(n:number)=>string} [valuta]     price formatter (prefixed with $)
 * @property {number} [elapsed]                total elapsed seconds (overrides clock calculation)
 * @property {number} [now]                    Date.now()
 *
 * @param {ChatProgressInput} input
 * @returns {string[]} array of formatted lines ready for console output
 */
export function formatChatProgress(input) {
	const {
		usage,
		clock,
		model,
		format = new Intl.NumberFormat("en-US").format,
		valuta = (value) => {
			const f = new Intl.NumberFormat("en-US", {
				minimumFractionDigits: 6,
				maximumFractionDigits: 6,
			}).format
			return `$${f(value)}`
		},
		now = Date.now(),
	} = input

	let elapsed = input.elapsed ?? ((now - clock.startTime) / 1e3)
	if (elapsed > 3600) elapsed = (now - clock.startTime) / 1e3 // Sanity check for overflow

	/** @type {Array<Array<any>>} */
	const rows = []
	let inputPrice = 0,
		reasonPrice = 0,
		answerPrice = 0

	const safeSpent = (spent) => Math.max(0, isNaN(spent) ? 0 : spent)
	const safeSpeed = (tokens, spent) => {
		const safeTokens = isNaN(tokens) ? 0 : tokens
		const safeSpentVal = safeSpent(spent)
		return safeSpentVal > 0 ? Math.round(safeTokens / safeSpentVal) : 0
	}

	// Reading (input / prompt) line
	if (usage.inputTokens) {
		const nowReading = clock.reasonTime ?? clock.answerTime ?? clock.startTime
		let readingSpent = safeSpent((nowReading - clock.startTime) / 1e3)
		if (!clock.reasonTime && !clock.answerTime) readingSpent = elapsed  // Full time if no phases
		const speed = safeSpeed(usage.inputTokens, readingSpent)
		inputPrice = (usage.inputTokens * model.pricing.prompt) / 1e6
		rows.push([
			"reading",
			isNaN(readingSpent) ? "0.0" : readingSpent.toFixed(1),
			usage.inputTokens !== undefined ? `${format(Number(usage.inputTokens))}T` : "",
			speed !== undefined ? `${format(Number(speed))}T/s` : "",
			inputPrice >= 0 ? valuta(inputPrice) : "$0.000000",
		])
	}

	// Reasoning (chain‑of‑thought) line
	if (usage.reasoningTokens && clock.reasonTime) {
		const spent = safeSpent(((clock.answerTime ?? now) - clock.reasonTime) / 1e3)
		const speed = safeSpeed(usage.reasoningTokens, spent)
		reasonPrice = (usage.reasoningTokens * model.pricing.completion) / 1e6
		rows.push([
			"reasoning",
			isNaN(spent) ? "0.0" : spent.toFixed(1),
			usage.reasoningTokens !== undefined ? `${format(Number(usage.reasoningTokens))}T` : "",
			speed !== undefined ? `${Number(speed)}T/s` : "",
			reasonPrice >= 0 ? valuta(reasonPrice) : "$0.000000",
		])
	}

	// Answering (output) line
	if (usage.outputTokens && clock.answerTime) {
		const spent = safeSpent((now - clock.answerTime) / 1e3)
		const speed = safeSpeed(usage.outputTokens, spent)
		answerPrice = (usage.outputTokens * model.pricing.completion) / 1e6
		rows.push([
			"answering",
			isNaN(spent) ? "0.0" : spent.toFixed(1),
			usage.outputTokens !== undefined ? `${format(Number(usage.outputTokens))}T` : "",
			speed !== undefined ? `${Number(speed)}T/s` : "",
			answerPrice >= 0 ? valuta(answerPrice) : "$0.000000",
		])
	}

	const total = usage.inputTokens + usage.reasoningTokens + usage.outputTokens
	const sum = inputPrice + reasonPrice + answerPrice
	rows.unshift([
		"chat progress",
		`${Number(elapsed).toFixed(1)}`,
		total ? `${format(Number(total))}T` : "",
		format(safeSpeed(total, elapsed)) + "T/s",
		valuta(sum)
	])

	/** Transform rows into printable columns */
	const formattedRows = rows.map(
		([label, spent, tokens, speed, price]) => [
			label,
			String(spent) + "s",
			tokens ?? "",
			speed ?? "",
			price ?? "",
		]
	)

	/** Determine max width of each column */
	const colWidths = formattedRows.reduce(
		(acc, row) =>
			row.map((cell, i) => Math.max(acc[i] ?? 0, String(cell).length)),
		[]
	)

	/** Pad each cell to its column width and join with a pipe */
	const paddedLines = formattedRows.map(row =>
		row
			.map((cell, i) => String(cell).padStart(colWidths[i]))
			.join(" | ")
	)

	return paddedLines
}
