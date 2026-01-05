/**
 *
 * @param {import("../FileProtocol").ParsedFile} parsed
 * @param {boolean} [isDry=false] If true yields messages without saving files
 * @param {string} [cwd] Current working directory
 * @param {(n: number) => string} [format] Formatting numbers function
 * @returns {AsyncGenerator<string | UiOutput>}
 */
export function unpackAnswer(parsed: import("../FileProtocol").ParsedFile, isDry?: boolean, cwd?: string, format?: (n: number) => string): AsyncGenerator<string | UiOutput>;
import { UiOutput } from "../cli/UiOutput.js";
