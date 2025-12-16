export default function getHuggingFaceInfo(plan?: string): {
    models: ((string | {
        /** Parameters amount (tokens) */
        parameters: number;
        /** Approx. speed in tokens per second (HF Inference varies) */
        speed: number;
        /** Pricing per 1M tokens - FREE tier */
        pricing: {
            prompt: number;
            completion: number;
            input_cache_read: number;
        };
        context_length: number;
        architecture: {
            modality: string;
            instruct_type: string;
        };
        name: string;
        description: string;
    })[] | (string | {
        parameters: number;
        speed: number;
        pricing: {
            prompt: number;
            completion: number;
            input_cache_read: number;
        };
        context_length: number;
        architecture: {
            modality: string;
        };
        name: string;
        description: string;
    })[])[];
};
