/**
 * Simple argument parser – returns an **instance** of the provided Model.
 *
 * @template T extends object
 * @param {string[]} argv - Raw arguments (process.argv.slice(2))
 * @param {new (...args:any)=>T} Model - Class whose static properties describe options.
 * @returns {T}
 */
export function parseArgv<T>(argv: string[], Model: new (...args: any) => T): T;
/**
 * @param {typeof Object} Model
 * @returns {string}
 */
export function renderHelp(Model: typeof Object): string;
