export default class TestOptions {
	/** @type {string[]} */
	argv = []
	static argv = {
		default: []
	}
	/** @type {string} */
	mode
	static mode = {
		alias: "mode",
		default: "info"
	}
	/** @type {number} */
	step
	static step = {
		alias: "step",
		default: 1
	}
	/** @type {string} */
	outputDir
	static outputDir = {
		alias: "dir",
		default: ""
	}
	/** @type {number} */
	delay
	static delay = {
		alias: "delay",
		default: 10
	}
	/** @param {Partial<TestOptions>} [input] */
	constructor(input = {}) {
		const {
			mode = String(TestOptions.mode.default),
			step = Number(TestOptions.step.default),
			outputDir = String(TestOptions.outputDir.default),
			delay = Number(TestOptions.delay.default),
			argv = Array.from(TestOptions.argv.default),
		} = input
		this.mode = String(mode)
		this.step = Number(step)
		this.outputDir = String(outputDir)
		this.delay = Number(delay)
		this.argv = argv
	}
}
