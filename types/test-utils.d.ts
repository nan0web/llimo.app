/**
 * Create a temporary workspace with test files
 * @param {Object} files - Map of filename -> content
 * @returns {Promise<string>} - Path to temporary directory
 */
export function createTempWorkspace(files?: any): Promise<string>;
/**
 * Execute a Node.js script in an isolated temporary directory
 * @param {Object} options
 * @param {string} options.cwd - Original working directory
 * @param {string} options.scriptPath - Path to the script to execute
 * @param {string[]} [options.args=[]] - Arguments to pass to the script
 * @param {string} [options.input] - Data to pipe to stdin
 * @returns {Promise<{ stdout:string, stderr:string, exitCode:number }>}
 */
export function runNodeScript({ cwd, scriptPath, args, input }: {
    cwd: string;
    scriptPath: string;
    args?: string[] | undefined;
    input?: string | undefined;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
/**
 * Clean up a temporary directory safely
 * @param {string} tempDir - Directory to clean up
 */
export function cleanupTempDir(tempDir: string): Promise<void>;
