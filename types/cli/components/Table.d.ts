export class Table extends UiOutput {
    static Options: typeof TableOptions;
    /**
     * @todo write jsdoc
     * @param {any[][] | object[]} rows
     * @returns {any[][]}
     */
    static normalizeRows(rows: any[][] | object[]): any[][];
    /**
     * @param {Partial<Table>} [input={}]
     */
    constructor(input?: Partial<Table>);
    /** @type {any[][] | object[]} */
    rows: any[][] | object[];
    /** @type {Partial<TableOptions>} */
    options: Partial<TableOptions>;
}
export type TableAlign = "left" | "center" | "right";
import { UiOutput } from "../UiOutput.js";
/**
 * @typedef {"left" | "center" | "right"} TableAlign
 */
declare class TableOptions {
    static divider: {
        help: string;
        default: string;
    };
    static aligns: {
        help: string;
        default: never[];
    };
    /**
     * @param {Partial<TableOptions> & { divider?: string | number }} input
     */
    constructor(input?: Partial<TableOptions> & {
        divider?: string | number;
    });
    /** @type {string} */
    divider: string;
    /** @type {TableAlign[]} */
    aligns: TableAlign[];
}
export {};
