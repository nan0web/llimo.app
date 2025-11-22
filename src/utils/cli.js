/**
 * Utility functions for parsing command‑line strings.
 * You can use a Schema interface to automatically load argv into an instance of Schema.
 *
 * @module utils/cli
 */

export class Schema {
	help
	static help = {
		type: Boolean,
		help: "Show help",
		default: false,
		/**
		 * Sanitizes the input value before validate
		 * @this {Schema} Instance of current Schema with other values
		 * @param {string} str
		 * @returns {boolean}
		 */
		sanitize: (str) => [true, "1", "on", "true"].includes(str),
		/**
		 * Validates the input value after sanitization (if provided)
		 * @this {Schema} Instance of current Schema with other values
		 * @param {any} value
		 * @returns {boolean}
		 */
		validate: value => "boolean" === typeof value,
	}
	/**
	 * @param {Partial<Schema>} input
	 */
	constructor(input = {}) {
		const {
			help = Schema.help.default,
		} = input
		this.help = Boolean(Schema.help.sanitize(help))
	}
}

/**
 * Parses the CLI arguments into arguments and options.
 * If a Schema class is supplied, the returned `opts` will be an *instance* of that class,
 * populated with the parsed options.
 *
 * Supported option syntaxes:
 *   --key=value   → { key: "value" }
 *   --key value   → { key: "value" }
 *   --flag        → { flag: true }
 *   -f            → { f: true }   (single‑character shortcut)
 *
 * @param {string[]} argv          Argument vector (e.g. process.argv)
 * @param {typeof Object} [SchemaClass] Optional Schema class to instantiate
 * @returns {{ args: string[], opts: Record<string, any> | Object }}
 */
export function parseArgv(argv = [], SchemaClass = undefined) {
	const args = []
	const opts = {}

	// Simple state machine – look ahead for values when needed
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i]

		if (token.startsWith("--")) {
			// Long option
			const clean = token.slice(2)
			const eqIdx = clean.indexOf("=")

			if (eqIdx >= 0) {
				// --key=value
				const key = clean.slice(0, eqIdx)
				const raw = clean.slice(eqIdx + 1)
				opts[key] = raw
			} else {
				// --key [value]  OR  --flag
				const next = argv[i + 1]
				if (next !== undefined && !next.startsWith("-")) {
					// Value follows as a separate token
					opts[clean] = next
					i++ // consume next token
				} else {
					// Stand‑alone flag → true
					opts[clean] = true
				}
			}
		} else if (token.startsWith("-") && token.length > 1) {
			// Short option (single character)
			// Treat each character after '-' as its own flag (e.g. -ab → a:true, b:true)
			const chars = token.slice(1).split("")
			for (const ch of chars) {
				opts[ch] = true
			}
		} else {
			// Positional argument
			args.push(token)
		}
	}

	// If a Schema class is given, instantiate it with the parsed options.
	// The Schema constructor is responsible for applying defaults / validation.
	const finalOpts = SchemaClass ? new SchemaClass(opts) : opts

	return { args, opts: finalOpts }
}
