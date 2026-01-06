export default class ChatOptions {
	/** @type {string[]} */
	argv = []
	static argv = {
		help: "Free arguments: text (markdown) file location as input file (pre-prompt) with attachments as markdown - [ignore-rules](location-as-glob)",
		default: []
	}
	/** @type {boolean} */
	isDebug
	static isDebug = {
		alias: "debug",
		help: "Debug mode to show more information",
		default: false,
	}
	/** @type {boolean} */
	isNew
	static isNew = {
		alias: "new",
		help: "New chat",
		default: false
	}
	/** @type {boolean} */
	isYes
	static isYes = {
		help: "Automatically answer yes to all questions",
		alias: "yes",
		default: false
	}
	/** @type {boolean} @deprecated Changed with the command test */
	isTest
	static isTest = {
		help: "Run in test mode",
		alias: "test",
		default: false,
	}
	/** @type {boolean} */
	isTiny
	static isTiny = {
		alias: "tiny",
		help: "Tiny view in one row that is useful as subtask usage",
		default: false,
	}
	/** @type {boolean} */
	isFix
	static isFix = {
		alias: "fix",
		help: "Fix the current project (starts with tests)",
		default: false
	}
	/** @type {string} @deprecated Moved to the command test */
	testDir
	static testDir = {
		alias: "test-dir",
		default: ""
	}
	/** @type {string} */
	model
	static model = {
		alias: "model",
		default: ""
	}
	/** @type {string} */
	provider
	static provider = {
		alias: "provider",
		help: "Ai provider, use / for subproviders such as huggingface/cerebras",
		default: ""
	}
	/** @type {number} */
	maxFails
	static maxFails = {
		alias: "max-fails",
		help: "Maximum number of failed iterations in a row",
		default: 3,
	}
	/** @type {boolean} */
	isHelp
	static isHelp = {
		alias: "help",
		help: "Show help",
		default: false
	}
	/** @param {Partial<ChatOptions>} [input] */
	constructor(input = {}) {
		const {
			/** @description casting is important due to reference  */
			isNew = ChatOptions.isNew.default,
			isYes = ChatOptions.isYes.default,
			isTiny = ChatOptions.isTiny.default,
			isHelp = ChatOptions.isHelp.default,
			isFix = ChatOptions.isFix.default,
			isTest = ChatOptions.isTest.default,
			testDir = ChatOptions.testDir.default,
			model = ChatOptions.model.default,
			provider = ChatOptions.provider.default,
			argv = ChatOptions.argv.default,
			maxFails = ChatOptions.maxFails.default,
			isDebug = ChatOptions.isDebug.default,
		} = input
		this.isDebug = Boolean(isDebug)
		this.isNew = Boolean(isNew)
		this.isYes = Boolean(isYes)
		this.isTiny = Boolean(isTiny)
		this.isHelp = Boolean(isHelp)
		this.isFix = Boolean(isFix)
		this.isTest = Boolean(isTest)
		this.testDir = String(testDir)
		this.model = model
		this.provider = String(provider)
		this.maxFails = Number(maxFails)
		this.argv = argv
	}
}
