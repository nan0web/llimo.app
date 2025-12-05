/**
 * Execute a shell command, return stdout / stderr / exit code.
 *
 * @param {string} command
 * @param {string[]} [args=[]]
 * @param {object} [input={}]
 * @param {string} [input.cwd=process.cwd()]
 * @param {(data: string|Error)=>void} [input.onData]
 * @param {(command:string,args:string[],options:object)=>import("node:child_process").ChildProcess} [input.spawn] -
 *   custom spawn implementation for testing, defaults to Node's `spawn`.
 * @returns {Promise<{stdout:string,stderr:string,exitCode:number}>}
 */
export function runCommand(command: string, args?: string[], input?: {
    cwd?: string | undefined;
    onData?: ((data: string | Error) => void) | undefined;
    spawn?: ((command: string, args: string[], options: object) => import("node:child_process").ChildProcess) | undefined;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
