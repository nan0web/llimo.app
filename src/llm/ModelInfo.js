import Pricing from "./Pricing.js"
import Architecture from "./Architecture.js"
import TopProvider from "./TopProvider.js"

/**
 * Represents information about a model.
 */
export default class ModelInfo {
	/** @type {string} - Model ID */
	id
	/** @type {Architecture} - Model architecture */
	architecture
	/** @type {string} */
	canonical_slug
	/** @type {number} */
	context_length
	/** @type {number} */
	created
	/** @type {object} */
	default_parameters
	/** @type {string} */
	description
	/** @type {string} */
	hugging_face_id
	/** @type {string} */
	name
	/** @type {number} */
	per_request_limit
	/** @type {Pricing} */
	pricing
	/** @type {string[]} - Supported parameters */
	supported_parameters
	/** @type {string} - Provider name (openai, cerebras, …) */
	provider
	/** @type {TopProvider} */
	top_provider

	/**
	 * @param {Partial<ModelInfo>} input 
	 */
	constructor(input = {}) {
		const {
			id = "",
			architecture = {},
			canonical_slug = "",
			context_length = 0,
			created = 0,
			default_parameters = {},
			description = "",
			hugging_face_id = "",
			name = "",
			per_request_limit = 0,
			pricing = {},
			supported_parameters = [],
			provider = "",
			top_provider = {},
		} = input
		this.id = String(id)
		this.architecture = new Architecture(architecture)
		this.canonical_slug = String(canonical_slug)
		this.context_length = Number(context_length)
		this.created = Number(created)
		this.default_parameters = { ...default_parameters }  // Shallow copy to ensure object
		this.description = String(description)
		this.hugging_face_id = String(hugging_face_id)
		this.name = String(name)
		this.per_request_limit = Number(per_request_limit)
		this.pricing = new Pricing(pricing)
		this.supported_parameters = Array.isArray(supported_parameters) ? [...supported_parameters] : []
		this.provider = String(provider)
		this.top_provider = new TopProvider(top_provider)
	}
}
