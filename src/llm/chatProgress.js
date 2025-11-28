/**
 * Helper for generating the chat‑progress lines shown during streaming.
 *
 * The function is a pure formatter – it receives runtime data and returns
 * ready‑to‑print strings.  It is unit‑tested in `chatProgress.test.js`.
 *
 * @typedef {Object} ChatProgressInput
 * @property {import("../llm/AI.js").Usage} usage
 * @property {{ startTime: number, reasonTime?: number, answerTime?: number }} clock
 * @property {import("../llm/AI.js").ModelInfo} model
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

	/** @type {Array<Array<any>>} */
	const rows = []
	let inputPrice = 0,
		reasonPrice = 0,
		answerPrice = 0

	// Reading (input / prompt) line
	if (usage.inputTokens) {
		const nowReading = clock.reasonTime ?? clock.answerTime ?? now
		const spent = (nowReading - clock.startTime) / 1e3
		const speed = Math.round(usage.inputTokens / spent)
		inputPrice = usage.inputTokens * model.pricing.prompt
		rows.push([
			"reading",
			spent,
			usage.inputTokens,
			format(speed),
			valuta(inputPrice),
		])
	}

	// Reasoning (chain‑of‑thought) line
	if (usage.reasoningTokens) {
		const spent = ((clock.answerTime ?? now) - (clock.reasonTime ?? clock.startTime)) / 1e3
		const speed = Math.round(usage.reasoningTokens / spent)
		reasonPrice = usage.reasoningTokens * model.pricing.completion
		rows.push([
			"reasoning",
			spent,
			usage.reasoningTokens,
			format(speed),
			valuta(reasonPrice),
		])
	}

	// Answering (output) line
	if (usage.outputTokens) {
		const spent =
			(now -
				(clock.answerTime ?? clock.reasonTime ?? clock.startTime)) /
			1e3
		const speed = Math.round(usage.outputTokens / spent)
		answerPrice = usage.outputTokens * model.pricing.completion
		rows.push([
			"answering",
			spent,
			usage.outputTokens,
			format(speed),
			valuta(answerPrice),
		])
	}

	const total = usage.inputTokens + usage.outputTokens + usage.reasoningTokens
	const sum = inputPrice + reasonPrice + answerPrice
	const whole = (now - clock.startTime) / 1e3
	rows.unshift(["chat progress", whole, total, Math.round(total / whole), valuta(sum)])

	/** Transform rows into printable columns */
	const formattedRows = rows.map(
		([label, spent, tokens, speed, price]) => [
			label,
			`${Number(spent).toFixed(1)}s`,
			tokens !== undefined && tokens !== "" ? `${format(Number(tokens))}T` : "",
			speed !== undefined && speed !== "" ? `${Number(speed)}T/s` : "",
			price ?? "",
		]
	)

	/** Determine max width of each column */
	const colWidths = formattedRows.reduce(
		(acc, row) =>
			row.map((cell, i) => Math.max(acc[i] ?? 0, cell.length)),
		[]
	)

	/** Pad each cell to its column width and join with a pipe */
	const paddedLines = formattedRows.map(row =>
		row
			.map((cell, i) => cell.padStart(colWidths[i]))
			.join(" | ")
	)

	return paddedLines
}
