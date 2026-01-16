/**
 * Simple progress indicator component.
 */
export class Progress extends UiOutput {
    /** @param {Partial<Progress>} [input={}] */
    constructor(input?: Partial<Progress>);
    /** @type {number} The percent in a natural form from 0 to 1 where is 1 = 100% */
    value: number;
    /** @type {string} */
    text: string;
    /** @type {string} */
    prefix: string;
    /** @type {string[]} */
    rows: string[];
    /**
     * @param {string} row
     */
    add(row: string): void;
    toString(options?: {}): string;
}
import { UiOutput } from "../UiOutput.js";
