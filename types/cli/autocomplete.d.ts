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
 * @property {string} id - Model ID (info.id, not full key)
 * @property {number} context
 * @property {number} maxOut
 * @property {string} provider
 * @property {string} modality
 * @property {number} inputPrice
 * @property {number} outputPrice
 * @property {number} speed
 * @property {boolean} tools
 * @property {boolean} json
 * @property {boolean} isModerated
 */
/**
 *
 * @param {ModelInfo} info
 * @param {string} [id]
 * @returns {ModelRow}
 */
export function model2row(info: ModelInfo, id?: string): ModelRow;
export namespace autocomplete {
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
    /**
     * - Model ID (info.id, not full key)
     */
    id: string;
    context: number;
    maxOut: number;
    provider: string;
    modality: string;
    inputPrice: number;
    outputPrice: number;
    speed: number;
    tools: boolean;
    json: boolean;
    isModerated: boolean;
};
import { ModelInfo } from "../llm/ModelInfo.js";
/**
 * Flatten models map into ModelRow[] for filtering/sorting.
 * @param {Map<string, import("../llm/ModelInfo").ModelInfo>} modelMap
 * @returns {ModelRow[]}
 */
declare function modelRows(modelMap: Map<string, import("../llm/ModelInfo").ModelInfo>): ModelRow[];
/**
 * Filter models based on ID substring (plain search) or field filters (@field=val).
 * @param {ModelRow[]} models
 * @param {string} search
 * @returns {ModelRow[]}
 */
declare function filterModels(models: ModelRow[], search: string): ModelRow[];
/**
 * Format context length (e.g. 131072 -> 131K)
 * @param {number} ctx
 * @returns {string}
 */
declare function formatContext(ctx: number): string;
/**
 * Highlight search term in a cell
 * @param {string} cell
 * @param {string} search
 * @returns {string}
 */
declare function highlightCell(cell: string, search: string): string;
/**
 * Parse field filter like @provider=novi or @context>32K
 * @param {string} filterStr e.g. "provider=novi" or "context>32K"
 * @returns {{field: string, op: string, value: string}} – returns empty strings when no explicit operator is present.
 */
declare function parseFieldFilter(filterStr: string): {
    field: string;
    op: string;
    value: string;
};
/**
 * Render table with dynamic widths and highlighting
 * @param {ModelRow[]} filtered
 * @param {string} search
 * @param {number} startIndex
 * @param {number} maxY
 * @param {Ui} ui
 * @returns {void}
 */
declare function renderTable(filtered: ModelRow[], search: string, startIndex: number, maxY: number, ui: Ui): void;
/**
 * Clear specific number of lines and move cursor to start
 * @param {number} lines
 */
declare function clearLines(lines: number): void;
/**
 * Interactive search with live keypress, scrolling, and command suggestions
 * @param {Map<string, import("../llm/ModelInfo").ModelInfo>} modelMap
 * @param {Ui} ui
 * @returns {Promise<void>}
 */
declare function interactive(modelMap: Map<string, import("../llm/ModelInfo").ModelInfo>, ui: Ui): Promise<void>;
/**
 * Output all models in pipe format for non-interactive use
 * @param {ModelRow[]} allModels
 * @param {Ui} ui
 */
declare function pipeOutput(allModels: ModelRow[], ui: Ui): void;
import { Ui } from "./Ui.js";
export {};
