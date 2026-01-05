import { Ui } from "../cli/Ui.js"
import { Usage } from "./Usage.js"
import { ModelInfo } from "./ModelInfo.js"

/**
 * @typedef {Object} ChatProgressInput
 * @property {Ui} ui
 * @property {Usage} usage
 * @property {{ startTime:number, reasonTime?:number, answerTime?:number }} clock
 * @property {ModelInfo} model
 * @property {boolean} [isTiny] tiny‑mode flag
 * @property {number} [step] step number (used in tiny mode)
 * @property {number} [now] Date.now()
 * @property {number} [precision=4]
 */

/**
 * Produce human‑readable progress rows.
 *
 * @param {ChatProgressInput} input
 * @returns {string[]}
 */
export function formatChatProgress(input) {
	const {
		ui = new Ui(),
		usage,
		clock,
		model,
		isTiny = false,
		step = 1,
		now = Date.now(),
		precision = 4,
	} = input

	const safe = (v) => (isNaN(v) || v === undefined ? 0 : v)

	const totalElapsed = safe(now - clock.startTime)

	/* --------------------------------------------------------------- */
	/* Phase rows (read, reason, answer)                               */
	/* --------------------------------------------------------------- */
	const rawRows = []
	let totalPrice = 0, totalTime = 0
	/** @type {Array<"read" | "reason" | "answer">} */
	const PHASES = ["read", "reason", "answer"]
	/** @type {Map<"read" | "reason" | "answer", { endAt: number, elapsed: number, tokens: number, speed: number, price: number }>} */
	const map = new Map()
	const costs = { input: 0, reason: 0, output: 0 }
	model.pricing.calc(usage, costs)

	/* READ */
	if (usage.inputTokens) {
		const endAt = clock.reasonTime || clock.answerTime || now
		const elapsed = safe(endAt - clock.startTime)
		const speed = elapsed > 0 ? Math.round(1e3 * usage.inputTokens / elapsed) : 0
		map.set("read", { endAt, elapsed, speed, price: costs.input, tokens: usage.inputTokens })
	}

	/* REASON */
	if (usage.reasoningTokens && clock.reasonTime) {
		const endAt = clock.answerTime || now
		const elapsed = safe(endAt - clock.reasonTime)
		const speed = elapsed > 0 ? Math.round(1e3 * usage.reasoningTokens / elapsed) : 0
		map.set("reason", { endAt, elapsed, speed, price: costs.reason, tokens: usage.reasoningTokens })
	}

	/* ANSWER */
	if (usage.outputTokens && clock.answerTime) {
		const endAt = now
		const elapsed = safe(endAt - clock.answerTime)
		const speed = elapsed > 0 ? Math.round(1e3 * usage.outputTokens / elapsed) : 0
		map.set("answer", { endAt, elapsed, speed, price: costs.output, tokens: usage.outputTokens })
	}

	/* --------------------------------------------------------------- */
	/* Tiny‑mode (single‑line)                                         */
	/* --------------------------------------------------------------- */
	if (isTiny) {
		const arr = Array.from(map.entries())
		const tinyPrice = arr.reduce((acc, [, item]) => acc + item.price, 0)
		const elapsed = arr.reduce((acc, [, item]) => acc + item.elapsed, 0)
		const totalTokens = arr.reduce((acc, [, item]) => acc + item.tokens, 0)
		const elapsedStr = ui.formats.timer(elapsed)
		const phase = map.has("answer") ? "answer" : map.has("reason") ? "reason" : "read"
		const value = map.get(phase)
		const count = value?.tokens || 0
		const phaseTokens = ui.formats.weight("T", count || 0)
		const time = value?.endAt || now
		const phaseTime = ui.formats.timer(safe(now - time))

		const phaseSpeed = value?.speed ? `${ui.formats.count(value.speed)}T/s` : "∞T/s"

		const totalTokensStr = ui.formats.leftTokens(model.context_length - totalTokens, model.context_length)

		return [
			`step ${step} | ${elapsedStr} | ${ui.formats.money(tinyPrice, precision)} | ${phase} | ${phaseTime} | ${phaseTokens} | ${phaseSpeed} | ${totalTokensStr}`,
		]
	}


	let totalTokens = 0

	for (const phase of PHASES) {
		const row = map.get(phase)
		if (row) {
			totalTime += row.elapsed
			totalPrice += row.price
			totalTokens += row.tokens
			rawRows.push([
				phase,
				ui.formats.timer(row.elapsed),
				ui.formats.money(row.price, precision),
				ui.formats.weight("T", row.tokens),
				ui.formats.count(row.speed) + "T/s"
			])
		}
	}

	/* --------------------------------------------------------------- */
	/* Chat summary row                                               */
	/* --------------------------------------------------------------- */

	// Sum of *display* elapsed times (read uses the 30 s offset)
	const totalSpeed = totalTime > 0 ? Math.round(1e3 * totalTokens / totalTime) : 0
	const totalSpeedStr = `${ui.formats.count(totalSpeed)}T/s`

	const extraTokens = Math.max(0, (model.context_length || 0) - totalTokens)
	const extraStr = ui.formats.weight("T", extraTokens)

	const chatRow = [
		"chat",
		ui.formats.timer(totalElapsed),
		ui.formats.money(totalPrice, precision),
		ui.formats.weight("T", totalTokens),
		totalSpeedStr,
		extraStr,
	]

	/* --------------------------------------------------------------- */
	/* Empty usage – fallback line                                     */
	/* --------------------------------------------------------------- */
	if (rawRows.length === 0) {
		return [
			`chat | ${ui.formats.timer(totalElapsed)} | ${ui.formats.money(0)} | 0T | 0T/s | ${extraStr}`,
		]
	}

	/* --------------------------------------------------------------- */
	/* Regular multi‑line output                                       */
	/* --------------------------------------------------------------- */
	const allRows = [...rawRows, chatRow]

	return ui.console.table(allRows, { silent: true, aligns: ["right", "right", "right", "right", "right"] })
}
