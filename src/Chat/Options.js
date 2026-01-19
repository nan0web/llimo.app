class TestOptions {
	static command = {
		help: "Command name such as npm or yarn or pnpm or any command of installed cli application",
		default: ""
	}
	/** @type {string} */
	command = TestOptions.command.default
	static args = {
		help: "Arguments to pass to tests command such as [test:all] or [--test, --test-timeout=3333]",
		default: []
	}
	/** @type {string[]} */
	args = TestOptions.args.default
	/**
	 * @param {Partial<TestOptions>} [input={}]
	 */
	constructor(input = {}) {
		Object.assign(this, input)
	}
	toString() {
		return `${this.command} ${this.args.join(" ")}`
	}
}

/**
 * Chat command-line options parser configuration.
 * Defines flags with defaults, aliases, help text.
 */
export default class ChatOptions {
	static argv = {
		help: "Free arguments: text (markdown) file location as input file (pre-prompt) with attachments as markdown - [ignore-rules](location-as-glob)",
		default: []
	}
	/** @type {string[]} Free arguments: text (markdown) file location as input file (pre-prompt) with attachments as markdown - [ignore-rules](location-as-glob) */
	argv = ChatOptions.argv.default.slice()
	static isDebug = {
		alias: "debug",
		help: "Debug mode to show more information",
		default: false,
	}
	/** @type {boolean} Debug mode to show more information */
	isDebug = ChatOptions.isDebug.default
	static isNew = {
		alias: "new",
		help: "New chat",
		default: false
	}
	/** @type {boolean} New chat */
	isNew = ChatOptions.isNew.default
	static isYes = {
		help: "Automatically answer yes to all questions",
		alias: "yes",
		default: false
	}
	/** @type {boolean} Automatically answer yes to all questions */
	isYes = ChatOptions.isYes.default
	static test = {
		help: "Run in test mode",
		default: { command: "pnpm", args: ["test:all"] },
	}
	/**
	 * @type {TestOptions} Run in test mode
	 */
	test = new TestOptions(ChatOptions.test.default)
	static isTiny = {
		alias: "tiny",
		help: "Tiny view in one row that is useful as subtask usage",
		default: false,
	}
	/** @type {boolean} Tiny view in one row that is useful as subtask usage */
	isTiny = ChatOptions.isTiny.default
	static isFix = {
		alias: "fix",
		help: "Fix the current project (starts with tests)",
		default: false
	}
	/** @type {boolean} Fix the current project (starts with tests) */
	isFix = ChatOptions.isFix.default
	static testDir = {
		alias: "test-dir",
		help: "Directory for the testing chat with packing/unpacking chat messages",
		default: ""
	}
	/**
	 * @type {string} Directory for the testing chat with packing/unpacking chat messages
	 * @deprecated Moved to the command test
	 */
	testDir = ChatOptions.testDir.default
	static model = {
		alias: "model",
		help: "LLM id or it's unique part, default is 'gpt-oss-120b'",
		default: "gpt-oss-120b"
	}
	/** @type {string} */
	model = ChatOptions.model.default
	static provider = {
		alias: "provider",
		help: "Ai provider, use slash / for subproviders such as huggingface/cerebras, default is 'cerebras'",
		default: "cerebras"
	}
	/** @type {string} Ai provider, use / for subproviders such as huggingface/cerebras */
	provider = ChatOptions.provider.default
	static maxFails = {
		alias: "max-fails",
		help: "Maximum number of failed iterations in a row",
		default: 3,
	}
	/** @type {number} Maximum number of failed iterations in a row */
	maxFails = ChatOptions.maxFails.default
	static isHelp = {
		alias: "help",
		help: "Show help",
		default: false
	}
	/** @type {boolean} Show help */
	isHelp = ChatOptions.isHelp.default
	static ignore = {
		help: "Ignored patterns for the injected or listed files",
		default: [".git", "node_modules"]
	}
	/** @type {string[]} Ignored patterns for the injected or listed files */
	ignore = ChatOptions.ignore.default.slice()
	/**
	 * Constructs options instance from partial input.
	 * @param {Partial<ChatOptions>} [input] - Partial options.
	*/
	static inputFile = {
		help: "Input file path (relative to cwd)",
		stack: "argv",
		default: "me.md"
	}
	/** @type {string} Input file path (relative to cwd) */
	inputFile = ChatOptions.inputFile.default
	static strategyFinance = {
		alias: "strategy-finance",
		help: "LLM communication strategy financing: free, cheap, medium, rich",
		/** @type {"free" | "cheap" | "medium" | "rich"} */
		default: "free",
	}
	/** @type {"free" | "cheap" | "medium" | "rich"} LLM communication strategy financing: free, cheap, medium, rich */
	strategyFinance = ChatOptions.strategyFinance.default
	// @todo add all the strategy options

	/**
	 * @param {Partial<ChatOptions> & { test?: Partial<TestOptions> }} [input={}]
	 */
	constructor(input = {}) {
		Object.assign(this, input)
		this.test = new TestOptions(this.test)
	}
}
