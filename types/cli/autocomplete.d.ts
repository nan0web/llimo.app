/**
 * Autocomplete for models – shared interactive search and filtering logic.
 * Can be used for other datasets too, but currently specialized for models.
 *
 * Export functions for easy testing and reuse.
 *
 * @module cli/autocomplete
 */
/**
 * @typedef {Object} ModelRow
 * @property {string} id
 * @property {number} context
 * @property {string} provider
 * @property {string} modality
 * @property {number} inputPrice
 * @property {number} outputPrice
 * @property {boolean} tools
 * @property {boolean} json
 */
/**
 * Flatten models map into ModelRow[] for filtering/sorting.
 * @param {Map<string, import("../llm/ModelInfo").default[]>} modelMap
 * @returns {ModelRow[]}
 */
export function modelRows(modelMap: Map<string, import("../llm/ModelInfo").default[]>): ModelRow[];
/**
 * Format context length (e.g. 131072 -> 131K)
 * @param {number} ctx
 * @returns {string}
 */
export function formatContext(ctx: number): string;
/**
 * Highlight search term in a cell
 * @param {string} cell
 * @param {string} search
 * @returns {string}
 */
export function highlightCell(cell: string, search: string): string;
/**
 * Parse field filter like @provider=novi or @context>32K
 * @param {string} filterStr e.g. "provider=novi" or "context>32K"
 * @returns {{field: string, op: string, value: string}} – returns empty strings when no explicit operator is present.
 */
export function parseFieldFilter(filterStr: string): {
    field: string;
    op: string;
    value: string;
};
/**
 * Filter models based on search string
 * @param {ModelRow[]} models
 * @param {string} search
 * @returns {ModelRow[]}
 */
export function filterModels(models: ModelRow[], search: string): ModelRow[];
/**
 * Render table with dynamic widths and highlighting
 * @param {ModelRow[]} filtered
 * @param {string} search
 * @param {number} startIndex
 * @param {number} maxY
 * @param {Ui} ui
 * @returns {void}
 */
export function renderTable(filtered: ModelRow[], search: string, startIndex: number, maxY: number, ui: Ui): void;
/**
 * Clear specific number of lines and move cursor to start
 * @param {number} lines
 */
export function clearLines(lines: number): void;
/**
 * Interactive search with live keypress, scrolling, and command suggestions
 * @param {Map<string, import("../llm/ModelInfo").default[]>} modelMap
 * @param {Ui} ui
 * @returns {Promise<void>}
 */
export function interactive(modelMap: Map<string, import("../llm/ModelInfo").default[]>, ui: Ui): Promise<void>;
/**
 * Output all models in pipe format for non-interactive use
 * @param {ModelRow[]} allModels
 */
export function pipeOutput(allModels: ModelRow[]): void;
export namespace autocompleteModels {
    export { modelRows };
    export { filterModels };
    export { formatContext };
    export { highlightCell };
    export { parseFieldFilter };
    export { renderTable };
    export { clearLines };
    export { interactive };
    export { pipeOutput };
}
export type ModelRow = {
    id: string;
    context: number;
    provider: string;
    modality: string;
    inputPrice: number;
    outputPrice: number;
    tools: boolean;
    json: boolean;
};
import Ui from "./Ui.js";
