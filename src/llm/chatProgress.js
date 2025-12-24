import Ui from "../cli/Ui.js"
import LanguageModelUsage from "./LanguageModelUsage.js"
import ModelInfo from "./ModelInfo.js"

/**
 * @typedef {Object} ChatProgressInput
 * @property {Ui} ui
 * @property {LanguageModelUsage} usage
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

	const totalElapsed = safe((now - clock.startTime) / 1e3)

	/* --------------------------------------------------------------- */
	/* Phase rows (read, reason, answer)                               */
	/* --------------------------------------------------------------- */
	const rawRows = []
	let totalPrice = 0, totalTime = 0

	/* READ */
	if (usage.inputTokens) {
		const readEnd = clock.reasonTime ?? clock.answerTime ?? now
		const readElapsed = safe((readEnd - clock.startTime) / 1e3)
		// For chat‑speed we hide the first 30 s (as per original UI)
		const readDisplayElapsed = Math.max(0, readElapsed - 30)

		const readSpeed = readElapsed > 0 ? Math.round(usage.inputTokens / readElapsed) : 0
		const readPrice = (usage.inputTokens * model.pricing.prompt) / 1_000_000
		const speedStr = `${ui.formats.count(readSpeed)}T/s`

		rawRows.push([
			"read",
			ui.formats.timer(readElapsed),
			ui.formats.money(readPrice, precision),
			ui.formats.weight("T", usage.inputTokens),
			speedStr,
		])
		totalPrice += readPrice
		totalTime += readElapsed
	}

	/* REASON */
	if (usage.reasoningTokens && clock.reasonTime) {
		const reasonEnd = clock.answerTime ?? now
		const reasonElapsed = safe((reasonEnd - clock.reasonTime) / 1e3)

		const reasonSpeed = reasonElapsed > 0 ? Math.round(usage.reasoningTokens / reasonElapsed) : 0
		const reasonPrice = (usage.reasoningTokens * model.pricing.completion) / 1_000_000
		const speedStr = `${ui.formats.count(reasonSpeed)}T/s`

		rawRows.push([
			"reason",
			ui.formats.timer(reasonElapsed),
			ui.formats.money(reasonPrice, precision),
			ui.formats.weight("T", usage.reasoningTokens),
			speedStr,
		])
		totalPrice += reasonPrice
		totalTime += reasonElapsed
	}

	/* ANSWER */
	if (usage.outputTokens && clock.answerTime) {
		const answerElapsed = safe((now - clock.answerTime) / 1e3)

		const answerSpeed = answerElapsed > 0 ? Math.round(usage.outputTokens / answerElapsed) : 0
		const answerPrice = (usage.outputTokens * model.pricing.completion) / 1_000_000
		const speedStr = `${ui.formats.count(answerSpeed)}T/s`

		rawRows.push([
			"answer",
			ui.formats.timer(answerElapsed),
			ui.formats.money(answerPrice, precision),
			ui.formats.weight("T", usage.outputTokens),
			speedStr,
		])
		totalPrice += answerPrice
		totalTime += answerElapsed
	}

	/* --------------------------------------------------------------- */
	/* Chat summary row                                               */
	/* --------------------------------------------------------------- */
	const totalTokens =
		safe(usage.inputTokens) + safe(usage.reasoningTokens) + safe(usage.outputTokens)

	// Sum of *display* elapsed times (read uses the 30 s offset)
	const totalSpeed = totalTime > 0 ? Math.round(totalTokens / totalTime) : 0
	const totalSpeedStr = `${ui.formats.count(totalSpeed)}T/s`

	const extraTokens = Math.max(0, (model.context_length ?? 0) - totalTokens)
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
	/* Tiny‑mode (single‑line)                                         */
	/* --------------------------------------------------------------- */
	if (isTiny) {
		const inputPrice = usage.inputTokens ? (usage.inputTokens * model.pricing.prompt) / 1e6 : 0
		const outputPrice = usage.outputTokens ? (usage.outputTokens * model.pricing.completion) / 1e6 : 0
		const reasonPrice = usage.reasoningTokens ? (usage.reasoningTokens * model.pricing.completion) / 1e6 : 0
		const tinyPrice = inputPrice + outputPrice + reasonPrice

		// elapsed formatting – plain seconds while < 60 s
		const elapsedStr = totalElapsed < 60 ? `${totalElapsed.toFixed(1)}s` : ui.formats.timer(totalElapsed)

		const phase = "answer"
		const phaseTokens = `${ui.formats.count(usage.outputTokens ?? 0)}T`
		const phaseTime = undefined !== clock.answerTime
			? ui.formats.timer(safe((now - clock.answerTime) / 1e3))
			: "0.0s"

		const phaseSpeedNum = totalElapsed > 0 ? Math.round((usage.outputTokens ?? 0) / totalElapsed) : 0
		const phaseSpeed = totalElapsed > 0 && (usage.outputTokens ?? 0) > 0
			? `${ui.formats.count(phaseSpeedNum)}T/s`
			: "∞T/s"

		const totalTokensStr = ui.formats.weight("T", totalTokens)

		return [
			`step ${step} | ${elapsedStr} | ${ui.formats.money(tinyPrice, precision)} | ${phase} | ${phaseTime} | ${phaseTokens} | ${phaseSpeed} | ${totalTokensStr} | ${extraStr}`,
		]
	}

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
