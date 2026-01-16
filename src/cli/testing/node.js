import yaml from "yaml"
import { FileSystem } from "../../utils/FileSystem.js"

/**
 * @typedef {Object} TapParseResult
 * @property {string} [version]
 * @property {TestInfo[]} tests
 * @property {Map<number, Error>} errors
 * @property {Map<number, string>} unknowns
 * @property {Map<string, number>} counts
 *
 * @typedef {TapParseResult & { tap: TapParseResult, ts: TapParseResult }} SuiteParseResult
 */

/**
 * TAP parser – extracts test‑level information from raw TAP output.
 */
export class Tap {
	/** @type {string[]} */
	rows
	/** @type {FileSystem} */
	fs
	/** @type {Map<number, string>} rows that are not part of a TAP test */
	unknowns = new Map()
	/** @type {Map<number, Error>} parsing errors */
	errors = new Map()
	/** @type {Map<string, number>} count of errors by type */
	counts = new Map()
	/** @type {TestInfo[]} */
	tests = []

	/** @param {Partial<Tap>} input */
	constructor(input) {
		const {
			rows = [],
			fs = new FileSystem(),
		} = input
		this.rows = rows
		this.fs = fs
	}

	/**
	 * Walk through all rows and produce a high‑level summary.
	 * @returns {TapParseResult}
	 */
	parse() {
		let version
		this.unknowns = new Map()
		this.errors = new Map()
		this.counts = new Map()
		this.tests = []

		const summary = [
			"# fail ",
			"# cancelled ",
			"# pass ",
			"# tests ",
			"# suites ",
			"# skipped ",
			"# todo ",
			"# duration_ms ",
		]
		const trans = { skipped: "skip", duration_ms: "duration" }
		summary.forEach(sum => {
			let name = sum.split(" ")[1]
			name = trans[name] ?? name
			this.counts.set(name, 0)
		})

		let overview = false
		let errors = []

		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i]
			const str = row.trim()
			const found = summary.find(s => str.startsWith(s))
			if (row.startsWith("TAP version ")) {
				version = row.slice(12)
				errors = []
			}
			else if (str.startsWith("# Subtest: ")) {
				i = this.collectTest({ i, errors })
				errors = []
			}
			else if (str.match(/^\d+\.\.\d+$/)) {
				// @todo use subtotal markers like "1..1" for validation
				errors = []
			}
			else if (found) {
				overview = true
				let [, name] = found.split(" ")
				if (trans[name]) name = trans[name]
				const val = str.slice(found.length)
				let value = this.counts.get(name) ?? 0
				value += name.includes("duration") ? parseFloat(val) : parseInt(val)
				this.counts.set(name, value)
				errors = []
			}
			else if (str.startsWith("# ")) {
				errors.push(str.slice(2))
			}
			else if (str.startsWith("not ok ")) {
				this.collectOk({ i, errors })
			}
			else if (str.startsWith("ok ")) {
				this.collectOk({ i, errors, ok: true })
			}
			else {
				this.unknowns.set(i, row)
				errors = []
			}
		}
		if (!overview && this.tests.length) {
			this.tests.forEach((info) => {
				const value = Number(this.counts.get(info.type))
				this.counts.set(info.type, value + 1)
			})
			this.counts.set("tests",
				(this.counts.get("fail") || 0) +
				(this.counts.get("pass") || 0) +
				(this.counts.get("skip") || 0) +
				(this.counts.get("todo") || 0)
			)
		}
		return {
			version,
			tests: this.tests,
			errors: this.errors,
			unknowns: this.unknowns,
			counts: this.counts,
		}
	}

	/**
	 * Collects test information from a subtest block.
	 *
	 * Handles both indented YAML (`---` ...) and non‑indented variants.
	 *
	 * @param {{ i: number, parent?: number, errors?: string[] }} input
	 * @returns {number} new index (position right after the processed block)
	 */
	collectTest(input) {
		const { i, parent, errors = [] } = input
		const row = this.rows[i]                // "# Subtest: ..."
		const str = row.trim()
		const text = str.slice(11)              // subtest title

		let j = i + 1
		const next = this.rows[j] ?? ""
		const clean = next.trim()
		const indent = next.split('').findIndex(s => s !== " ")

		let value = ""
		let fail = false
		if (clean.startsWith("# Subtest: ")) {
			const nextI = this.collectTest({ i: j, parent: i })
			return nextI
		}
		else if (clean.startsWith("not ok ")) {
			value = clean.slice(7)
			fail = true
		}
		else if (clean.startsWith("ok ")) {
			value = clean.slice(3)
		}
		else {
			this.unknowns.set(j, next)
			return j
		}
		const [no_, , ...v] = value.split(" ")
		const no = parseInt(no_)
		const status = v.join(" ").slice(text.length).trim()

		// -----------------------------------------------------------------
		// YAML block handling – works with or without leading indentation.
		// -----------------------------------------------------------------
		++j
		const yamlLines = []
		if (this.rows[j]?.trim() === "---") {
			// Consume the opening delimiter.
			j++
			for (; j < this.rows.length; j++) {
				const line = this.rows[j].slice(indent)
				if (line.trim() === "...") break
				yamlLines.push(line)
			}
			// Skip the closing delimiter.
			j++
		}
		// -----------------------------------------------------------------

		let doc = {}
		try {
			doc = yaml.parse(yamlLines.join("\n"))
		} catch (/** @type {any} */ err) {
			this.errors.set(j, err)
			doc = { errors: [err] }
		}
		if (!doc) doc = { errors: [] }
		if (errors.length) {
			doc.errors = errors.slice()
		}
		/** @type {[number, number]} */
		let position = [0, 0]
		let file
		if (doc?.location) {
			const [loc, x, y = "0"] = doc.location.split(":")
			position = [parseInt(x), parseInt(y)]
			file = this.fs.path.relative(this.fs.path.cwd, this.fs.path.resolve(this.fs.path.cwd, loc))
		}
		this.tests.push({
			type: "# TODO" === status ? "todo"
				: "# SKIP" === status ? "skip"
					: "testTimeoutFailure" === doc?.failureType ? "cancelled"
						: fail ? "fail" : "pass",
			no,
			text,
			indent,
			position,
			doc,
			file,
			parent,
		})
		// Return index of the line just before the next iteration will increment.
		return j - 1
	}

	/**
	 * Collects test information from a {not ok|ok} block.
	 *
	 * @param {{ i: number, errors?: string[], ok?: boolean }} input
	 * @returns {number} new index (position right after the processed block)
	 */
	collectOk(input) {
		const { i, errors = [], ok = false } = input
		const row = this.rows[i]
		const str = row.trim()
		const text = str.slice(ok ? 3 : 7)
		const [line, status = ""] = text.split(" # ")
		const [no, tail = ""] = line.split(" - ")
		const [file, ...pos] = tail.split(":")
		const [x, y = ""] = pos.join(":").split(":")
		const position = [Number(x), Number(y)]

		const yamlLines = []
		const parent = undefined
		let indent
		let j = i + 1
		for (; j < this.rows.length; j++) {
			const sub = this.rows[j]
			const spaces = sub.split("").findIndex(c => " " !== c)
			if (!indent) indent = spaces
			if (indent > spaces) {
				break
			}
			if (["...", "---"].includes(sub.slice(indent))) {
				continue
			}
			yamlLines.push(sub.slice(indent))
		}
		let doc = {}
		try {
			doc = yaml.parse(yamlLines.join("\n"))
		} catch (/** @type {any} */ err) {
			this.errors.set(j, err)
			doc = { errors: [err] }
		}
		this.tests.push({
			type: "# TODO" === status ? "todo"
				: "# SKIP" === status ? "skip"
					: "testTimeoutFailure" === doc?.failureType ? "cancelled"
						: ok ? "pass" : "fail",
			no: Number(no),
			text,
			indent: indent || 0,
			position,
			doc,
			file,
			parent,
		})
		return j
	}
}

export class DeclarationTS extends Tap {
	/**
	 * Walk through all rows and collect types errors.
	 * @returns {TapParseResult}
	 */
	parse() {
		this.unknowns = new Map()
		this.errors = new Map()
		this.counts = new Map([["types", 0]])
		this.tests = []

		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i]
			const str = row.trim()
			const match = str.match(/^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/)
			if (match) {
				i = this.collectTest({ i, match })
			}
			else {
				this.unknowns.set(i, row)
			}
		}
		this.tests.forEach(t => {
			const count = this.counts.get(`TS${t.no}`) ?? 0
			this.counts.set(`TS${t.no}`, count + 1)
		})
		return {
			version: "1",
			tests: this.tests,
			errors: this.errors,
			unknowns: this.unknowns,
			counts: this.counts,
		}
	}
	/**
	 *
	 * @param {Object} input
	 * @param {number} input.i
	 * @param {RegExpMatchArray} input.match
	 * @returns {number}
	 */
	collectTest(input) {
		const { i, match } = input
		// const row = this.rows[i]
		// const str = row.trim()
		let j = i + 1
		const addon = []
		for (; j < this.rows.length; j++) {
			const row = this.rows[j]
			if (!row.startsWith("  ")) break
			addon.push(row)
		}
		this.tests.push({
			file: match[1],
			position: [parseInt(match[2]), parseInt(match[3])],
			no: parseInt(match[4]),
			text: [match[5], ...addon].join("\n"),
			type: "types",
			indent: 0,
		})
		return j - 1
	}
}

export class Suite extends Tap {
	/**
	 * @returns {SuiteParseResult}
	 */
	parse() {
		const tap = new Tap({ rows: this.rows, fs: this.fs })
		const tapped = tap.parse()
		// await fs.save("node-tap.json", tapped)
		const ts = new DeclarationTS({ rows: Array.from(tapped.unknowns.values()), fs: this.fs })
		const tsed = ts.parse()
		const counts = new Map(tapped.counts)
		counts.set("types", tsed.tests.length)
		const errors = new Map([
			...Array.from(tapped.errors.entries()),
			...Array.from(tsed.errors.entries())
		])
		// await fs.save("node-ts.json", tsed)
		return {
			tap: tapped,
			ts: tsed,
			errors,
			unknowns: tsed.unknowns,
			counts,
			tests: [...tapped.tests, ...tsed.tests],
		}
	}
}

/**
 * @typedef {"todo" | "fail" | "pass" | "cancelled" | "skip" | "types"} TestType
 *
 * @typedef {Object} TestInfo
 * @property {TestType} type
 * @property {number} no
 * @property {string} text
 * @property {number} indent
 * @property {number} [parent]
 * @property {string} [file]
 * @property {object} [doc]
 * @property {number[]} [position] Row x Column position.
 *
 * @typedef {Object} TestOutputLogEntry
 * @property {number} i
 * @property {number} no
 * @property {string} str
 *
 * @typedef {Object} TestOutputLogs
 * @property {TestOutputLogEntry[]} fail
 * @property {TestOutputLogEntry[]} cancelled
 * @property {TestOutputLogEntry[]} pass
 * @property {TestOutputLogEntry[]} tests
 * @property {TestOutputLogEntry[]} suites
 * @property {TestOutputLogEntry[]} skip
 * @property {TestOutputLogEntry[]} todo
 * @property {TestOutputLogEntry[]} duration
 * @property {TestOutputLogEntry[]} types
 *
 * @typedef {Object} TestOutputCounts
 * @property {number} fail
 * @property {number} cancelled
 * @property {number} pass
 * @property {number} tests
 * @property {number} suites
 * @property {number} skip
 * @property {number} todo
 * @property {number} duration
 * @property {number} types
 *
 * @typedef {{ logs: TestOutputLogs, counts: TestOutputCounts, types: Set<number>, tests: TestInfo[], guess: TestOutputCounts }} TestOutput
 */
