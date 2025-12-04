export default class ChatOptions {
	/** @type {string[]} */
	argv = []
	static argv = {
		default: []
	}
	/** @type {boolean} */
	isNew
	static isNew = {
		alias: "new",
		default: false
	}
	/** @type {boolean} */
	isYes
	static isYes = {
		alias: "yes",
		default: false
	}
	/** @type {string} */
	testMode
	static testMode = {
		alias: "test",
		default: ""
	}
	/** @type {string} */
	testDir
	static testDir = {
		alias: "test-dir",
		default: ""
	}
	/** @param {Partial<ChatOptions>} [input] */
	constructor(input = {}) {
		const {
			/** @description casting is important due to reference  */
			isNew = Boolean(ChatOptions.isNew.default),
			isYes = Boolean(ChatOptions.isYes.default),
			testMode = String(ChatOptions.testMode.default),
			testDir = String(ChatOptions.testDir.default),
			argv = Array.from(ChatOptions.argv.default),
		} = input
		this.isNew = Boolean(isNew)
		this.isYes = Boolean(isYes)
		this.testMode = String(testMode)
		this.testDir = String(testDir)
		this.argv = argv
	}
}
