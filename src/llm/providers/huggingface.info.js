/**
 * Static model information for Hugging Face Inference API.
 *
 * These are popular instruct-tuned models available on the free tier of the
 * Hugging Face Inference API. Pricing is set to 0 for free usage; paid tiers
 * may have different costs based on compute time.
 *
 * Models are selected for chat/instruction following. Context lengths and
 * parameters are approximate from model cards.
 *
 * Note: Access to some models (e.g., Llama) may require Hugging Face approval.
 */

const free = {
	models: [
		[
			"mistralai/Mistral-7B-Instruct-v0.2",
			{
				/** Parameters amount (tokens) */
				parameters: 7e9,
				/** Approx. speed in tokens per second (HF Inference varies) */
				speed: 50, // Conservative estimate for inference
				/** Pricing per 1M tokens - FREE tier */
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
				context_length: 32768,
				architecture: { modality: "text", instruct_type: "chatml" },
				name: "Mistral 7B Instruct v0.2",
				description: "Efficient instruct model for chat and tasks"
			},
		],
		[
			"meta-llama/Llama-2-7b-chat-hf",
			{
				parameters: 7e9,
				speed: 40,
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
				context_length: 4096,
				architecture: { modality: "text", instruct_type: "llama2" },
				name: "Llama 2 7B Chat",
				description: "Meta's chat-tuned Llama 2 model"
			},
		],
		[
			"microsoft/DialoGPT-medium",
			{
				parameters: 345e6,
				speed: 100,
				pricing: { prompt: 0, completion: 0, input_cache_read: 0 },
				context_length: 1024,
				architecture: { modality: "text" },
				name: "DialoGPT Medium",
				description: "Microsoft's conversational GPT model"
			},
		],
		// Add more models as needed
	],
}

export default function getHuggingFaceInfo(plan = "free") {
	if ("free" === plan) return free
	// Paid tiers can be added later with real pricing
	return { models: [] }
}

