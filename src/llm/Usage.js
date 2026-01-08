export class Limits {
	/** @type {number | undefined} Remaining requests per day */
	rpd
	static rpd = {
		alias: "x-ratelimit-remaining-requests-day",
	}
	/** @type {number | undefined} Remaining requests per hour */
	rph
	static rph = {
		alias: "x-ratelimit-remaining-requests-hour",
	}
	/** @type {number | undefined} Remaining requests per minute */
	rpm
	static rpm = {
		alias: "x-ratelimit-remaining-requests-minute",
	}
	/** @type {number | undefined} Remaining tokens per day */
	tpd
	static tpd = {
		alias: "x-ratelimit-remaining-tokens-day",
	}
	/** @type {number | undefined} Remaining tokens per hour */
	tph
	static tph = {
		alias: "x-ratelimit-remaining-tokens-day",
	}
	/** @type {number | undefined} Remaining tokens per minute */
	tpm
	static tpm = {
		alias: "x-ratelimit-remaining-tokens-day",
	}
	/** @param {Partial<Limits>} [input] */
	constructor(input = {}) {
		Object.entries(Limits).forEach(([name, el]) => {
			if (undefined === input[name] && input[el.alias]) input[name] = input[el.alias]
		})
		const {
			rpd = Limits.rpd.default,
			rph = Limits.rph.default,
			rpm = Limits.rpm.default,
			tpd = Limits.tpd.default,
			tph = Limits.tph.default,
			tpm = Limits.tpm.default,
		} = input
		this.rpd = undefined === rpd ? rpd : Number(rpd)
		this.rph = undefined === rph ? rph : Number(rph)
		this.rpm = undefined === rpm ? rpm : Number(rpm)
		this.tpd = undefined === tpd ? tpd : Number(tpd)
		this.tph = undefined === tph ? tph : Number(tph)
		this.tpm = undefined === tpm ? tpm : Number(tpm)
	}
	/** @returns {boolean} */
	get empty() {
		return undefined === this.rpd &&
			undefined === this.rph &&
			undefined === this.rpm &&
			undefined === this.tpd &&
			undefined === this.tph &&
			undefined === this.tpm
	}
}

export class Usage {
	/** @type {number} */
	inputTokens
	/** @type {number} */
	reasoningTokens
	/** @type {number} */
	outputTokens
	/** @type {number} */
	cachedInputTokens
	/** @param {Partial<Limits>} [input] */
	limits
	constructor(input = {}) {
		const {
			inputTokens = 0,
			reasoningTokens = 0,
			outputTokens = 0,
			cachedInputTokens = 0,
			limits = new Limits(),
		} = input
		this.inputTokens = Number(inputTokens)
		this.reasoningTokens = Number(reasoningTokens)
		this.outputTokens = Number(outputTokens)
		this.cachedInputTokens = Number(cachedInputTokens)
		this.limits = new Limits(limits)
	}
	/** @returns {number} */
	get totalTokens() {
		return this.inputTokens + this.reasoningTokens + this.outputTokens
	}
}
