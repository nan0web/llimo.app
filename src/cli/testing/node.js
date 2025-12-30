import yaml from "yaml"
import FileSystem from "../../utils/FileSystem.js"

/**
 * @typedef {Object} TapParseResult
 * @property {string} [version]
 * @property {TestInfo[]} tests
 * @property {Map<number, Error>} errors
 * @property {Map<number, string>} unknowns
 * @property {Map<string, number>} counts
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

		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i]
			const str = row.trim()
			const found = summary.find(s => str.startsWith(s))
			if (row.startsWith("TAP version ")) {
				version = row.slice(12)
			}
			else if (str.startsWith("# Subtest: ")) {
				i = this.collectTest({ i })
			}
			else if (str.match(/^\d+\.\.\d+$/)) {
				// @todo use subtotal markers like "1..1" for validation
			}
			else if (found) {
				let [, name] = found.split(" ")
				if (trans[name]) name = trans[name]
				const val = str.slice(found.length)
				let value = this.counts.get(name) ?? 0
				value += name.includes("duration") ? parseFloat(val) : parseInt(val)
				this.counts.set(name, value)
			}
			else {
				this.unknowns.set(i, row)
			}
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
	 * @param {{ i: number, parent?: number }} input
	 * @returns {number} new index (position right after the processed block)
	 */
	collectTest(input) {
		const { i, parent } = input
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
			const x = 9
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
			doc = {}
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
	 * @returns {TapParseResult & { tap: TapParseResult, ts: TapParseResult }}
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
			tests: [...tapped.tests, ...tsed.tests],
			counts,
		}
	}
}

/**
 * @typedef {Object} TestInfo
 * @property {"todo" | "fail" | "pass" | "cancelled" | "skip" | "types"} type
 * @property {number} no
 * @property {string} text
 * @property {number} indent
 * @property {number} [parent]
 * @property {string} [file]
 * @property {object} [doc]
 * @property {[number, number]} [position]
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
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {FileSystem} [fs]
 * @returns {TestOutput}
 */
export function parseOutput(stdout, stderr, fs = new FileSystem()) {
	const logs = {
		fail: [],
		cancelled: [],
		pass: [],
		tests: [],
		suites: [],
		skip: [],
		todo: [],
		duration: [],
		types: [],
		missing: [],
	}
	const counts = {
		fail: 0,
		cancelled: 0,
		pass: 0,
		tests: 0,
		suites: 0,
		skip: 0,
		todo: 0,
		duration: 0,
		types: 0,
	}
	const guess = {
		fail: 0,
		cancelled: 0,
		pass: 0,
		tests: 0,
		suites: 0,
		skip: 0,
		todo: 0,
		duration: 0,
		types: 0,
	}
	const out = stdout.split("\n")
	const err = stderr.split("\n")
	const all = [...out, ...err]

	const parser = {
		fail: ["# fail ", "ℹ fail "],
		cancelled: ["# cancelled ", "ℹ cancelled "],
		pass: ["# pass ", "ℹ pass "],
		tests: ["# tests ", "ℹ tests "],
		suites: ["# suites ", "ℹ suites "],
		skip: ["# skipped ", "ℹ skipped "],
		todo: ["# todo ", "ℹ todo "],
		duration: ["# duration_ms ", "ℹ duration_ms "],
	}

	/** @type {TestInfo[]} */
	const tests = []

	for (let i = 0; i < all.length; i++) {
		const row = all[i]
		const str = row.trim()
		const spaces = all[i].split('').findIndex(s => s != " ")
		const notOk = str.match(/^not ok (\d+) - (.*)$/)
		const ok = str.match(/^ok (\d+) - (.*)$/)
		const dts = str.match(/^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)/)

		if (row.startsWith("TAP version ")) {
			// ignored – version already processed by Tap
		}
		else if (str.startsWith("# Subtest: ")) {
			const tap = new Tap({ rows: all, fs })
			i = tap.collectTest({ i })
			tests.push(...tap.tests)
		}
		else if (str.match(/^\d+\.\.\d+$/)) {
			// ignore subtotal markers
		}
		else {
			for (const [name, arr] of Object.entries(parser)) {
				if (!(name in counts)) continue
				for (const s of arr) {
					if (str.startsWith(s)) {
						if (name === "duration") {
							counts[name] += parseFloat(str.slice(s.length))
						} else {
							counts[name] += parseInt(str.slice(s.length))
						}
					}
				}
			}
		}
	}

	const types = new Set()
	for (const test of tests) {
		if (test.type in guess) ++guess[test.type]
		if (test.type === "types") {
			types.add(test.no)
			counts.types++
		}
		guess.duration += test.doc?.duration_ms || 0
	}
	// deterministic rounding
	counts.duration = Math.round(counts.duration * 1e3) / 1e3

	return { counts, guess, logs, tests, types }
}
