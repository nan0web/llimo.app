/**
 * Filter models based on fuzzy search or field filters.
 * @param {ModelInfo[]} models - Array of models to filter
 * @param {string} search - Search term or field filter
 * @returns {ModelInfo[]} - Filtered models
 */
export function filterModels(models: ModelInfo[], search: string): ModelInfo[];
declare namespace _default {
    export { filterModels };
}
export default _default;
import { ModelInfo } from './ModelInfo.js';
