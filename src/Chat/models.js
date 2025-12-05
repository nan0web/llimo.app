import { Ui } from "../cli/index.js"
import ModelInfo from "../llm/ModelInfo.js"
import ModelProvider from "../llm/ModelProvider.js"

/**
 * @param {Ui} ui
 * @returns {Promise<Map<string, ModelInfo>>}
 */
export async function loadModels(ui) {
	const provider = new ModelProvider()

	let str = "Loading models …"
	ui.console.info(str)
	let name = "", raw = "", models = [], pros = new Set()
	const loading = ui.createProgress(({ elapsed }) => {
		let str = "Loading models …"
		if (name) str = `Loading models @${name} (${models.length} in ${elapsed}ms)`
		ui.overwriteLine(str)
	})
	const map = await provider.getAll({
		onBefore: (n) => { name = n },
		onData: (n, r, m) => {
			pros.add(n)
			name = n
			raw = r
			models.push(...m)
		}
	})
	map.forEach((info) => pros.add(info.provider))

	ui.overwriteLine("")
	ui.cursorUp(1)
	ui.overwriteLine(`Loaded ${map.size} models from ${pros.size} providers`)
	ui.console.info("")
	clearInterval(loading)
	return map
}
