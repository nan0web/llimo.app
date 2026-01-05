import { Ui } from "../cli/Ui.js"
import { ModelInfo } from "../llm/ModelInfo.js"
import { ModelProvider } from "../llm/ModelProvider.js"

/**
 * @param {{ noCache?: boolean, ui?: Ui }} [opts={}]
 * @returns {Promise<Map<string, ModelInfo>>}
 */
export async function loadModels(opts = {}) {
	const { ui } = opts
	const provider = new ModelProvider()

	let name = "", raw = "", models = [], pros = new Set()
	let loading
	if (ui) {
		let str = "Loading models …"
		ui.console.info(str)
		loading = ui.createProgress(({ elapsed }) => {
			let str = "Loading models …"
			if (name) str = `Loading models @${name} (${models.length} in ${elapsed}ms)`
			ui.overwriteLine(str)
		})
	}
	const map = await provider.getAll({
		onBefore: (n) => { name = n },
		onData: (n, r, m) => {
			pros.add(n)
			name = n
			raw = r
			models.push(...m)
		},
		...opts
	})
	if (ui) {
		ui.overwriteLine("")
		ui.cursorUp(1)
		const arr = Array.from(pros).sort()
		ui.overwriteLine(`@ Loaded ${map.size} inference models from ${pros.size} providers`)
		ui.console.info("")
		arr.forEach(pro => ui.console.info(`> ${pro}`))
		clearInterval(loading)
	}
	return map
}
