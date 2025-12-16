export class Table extends UiOutput {
    /**
     * @param {Partial<Table>} [input={}]
     */
    constructor(input?: Partial<Table>);
    /** @type {any[][]} */
    rows: any[][];
    /** @type {{divider?: string | number, aligns?: string[]}} */
    options: {
        divider?: string | number;
        aligns?: string[];
    };
}
export default Table;
import UiOutput from "../UiOutput.js";
