/**
 * Simple argument parser – returns an **instance** of the provided Model.
 *
 * @template T extends object
 * @param {string[] | Record<string, any>} argv - Raw arguments (process.argv.slice(2)) or object <key, value>
 * @param {new (...args:any)=>T} Model - Class whose static properties describe options.
 * @param {Record<string, any>} [defaultValue={}]
 * @returns {T}
 */
export function parseArgv<T>(argv: string[] | Record<string, any>, Model: new (...args: any) => T, defaultValue?: Record<string, any>): T;
/**
 * @param {typeof Object} Model
 * @returns {string}
 */
export function renderHelp(Model: typeof Object): string;
