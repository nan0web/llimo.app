/**
 * Runs a Node.js script with optional input and arguments.
 * @param {Object} options
 * @param {string} options.scriptPath - Path to the script.
 * @param {string} [options.inputData] - Data to pipe to stdin.
 * @param {string[]} [options.args] - Arguments to pass.
 * @param {string} [options.cwd] - Working directory.
 * @param {string} [options.tempDir] - Temp dir to use as cwd.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, tempDir: string}>}
 */
export function runNodeScript({ scriptPath, inputData, args, cwd, tempDir }: {
    scriptPath: string;
    inputData?: string | undefined;
    args?: string[] | undefined;
    cwd?: string | undefined;
    tempDir?: string | undefined;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    tempDir: string;
}>;
/**
 * Cleans up a temporary directory.
 * @param {string} tempDir
 */
export function cleanupTempDir(tempDir: string): Promise<void>;
