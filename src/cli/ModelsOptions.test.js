import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { ModelsOptions } from "./ModelsOptions.js"

describe("ModelsOptions – filter parsing", () => {
	it("equality filter on price with precision", () => {
		const opts = new ModelsOptions({ filter: "price=2" })
		const dummy = {
			id: "test-model",
			provider: "cerebras",
			context_length: 200_000,
			pricing: { completion: 2.01 }
		}
		const pred = opts.getFilters()[0]
		// 2.01 rounds to 2 → should match
		assert.ok(pred(dummy), "price 2.01 rounds to 2 – should match =2")
	})

	it("regex filter on id", () => {
		const opts = new ModelsOptions({ filter: "id~gpt" })
		const m = { id: "gpt-oss-120b", provider: "", context_length: 0, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("exact id filter", () => {
		const opts = new ModelsOptions({ filter: "id=gpt-oss-120b" })
		const m = { id: "gpt-oss-120b", provider: "", context_length: 0, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("context length greater than", () => {
		const opts = new ModelsOptions({ filter: "context>100K" })
		const m = { id: "", provider: "", context_length: 150_000, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("provider regex filter", () => {
		const opts = new ModelsOptions({ filter: "provider~bra" })
		const m = { id: "", provider: "cerebras", context_length: 0, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("invalid operation throws", () => {
		assert.throws(() => {
			new ModelsOptions({ filter: "price~5" }).getFilters()
		}, /No such operation/)
	})

	it("equality filter on price with precision", () => {
		const opts = new ModelsOptions({ filter: "price=2" })
		const dummy = {
			id: "test-model",
			provider: "cerebras",
			context_length: 200_000,
			pricing: { completion: 2.01 }
		}
		const pred = opts.getFilters()[0]
		assert.ok(pred(dummy), "price 2.01 rounds down to 2 and should match =2")
	})

	it("regex filter on id", () => {
		const opts = new ModelsOptions({ filter: "id~gpt" })
		const m = { id: "gpt-oss-120b", provider: "", context_length: 0, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("exact id filter", () => {
		const opts = new ModelsOptions({ filter: "id=gpt-oss-120b" })
		const m = { id: "gpt-oss-120b", provider: "", context_length: 0, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("context length greater than", () => {
		const opts = new ModelsOptions({ filter: "context>100K" })
		const m = { id: "", provider: "", context_length: 150000, pricing: { completion: 0 } }
		assert.ok(opts.getFilters()[0](m))
	})

	it("provider regex filter", () => {
		const opts = new ModelsOptions({ filter: "provider~bra" })
		const m = { id: "", provider: "cerebras", context_length: 0, pricing: { completion: 0 } }
		const first = opts.getFilters()[0]
		assert.ok(first(m))
	})

	it("invalid operation throws", () => {
		assert.throws(() => {
			new ModelsOptions({ filter: "price?5" }).getFilters()
		}, /No valid filters parsed from "price\?5"/)
	})
})
