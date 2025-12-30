/**
 * Validates API key for a provider and throws if missing.
 * @param {string} provider - Provider name (e.g., 'openai')
 * @throws {Error} If API key is missing, with provider-specific help.
 */
export function validateApiKey(provider: string): void;
declare namespace _default {
    export { validateApiKey };
}
export default _default;
