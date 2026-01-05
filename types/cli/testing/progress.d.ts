/**
 * @param {import("./node.js").TapParseResult} parsed
 * @returns
 */
export function testingStatus(parsed: import("./node.js").TapParseResult, elapsed?: string): string;
/**
 * Creates progress for testing commands.
 * @param {object} param0
 * @param {Ui} param0.ui
 * @param {FileSystem} [param0.fs]
 * @param {string[]} [param0.output]
 * @param {number} [param0.rows=0]
 * @param {string} [param0.prefix=""]
 * @param {number} [param0.startTime]
 * @param {number} [param0.fps=33]
 * @returns {NodeJS.Timeout}
 */
export function testingProgress({ ui, fs, output, rows, prefix, startTime, fps }: {
    ui: Ui;
    fs?: FileSystem | undefined;
    output?: string[] | undefined;
    rows?: number | undefined;
    prefix?: string | undefined;
    startTime?: number | undefined;
    fps?: number | undefined;
}): NodeJS.Timeout;
import { Ui } from "../Ui.js";
import { FileSystem } from "../../utils/FileSystem.js";
