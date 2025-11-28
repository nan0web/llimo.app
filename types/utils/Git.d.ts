/**
 * Simple wrapper for git commands
 */
export default class Git {
    /**
     * @param {Partial<Git>} [input={}]
     */
    constructor(input?: Partial<Git>);
    /** @type {string} */
    cwd: string;
    /** @type {boolean} */
    dry: boolean;
    /**
     * Execute a git command
     * @param {string[]} args
     * @returns {Promise<{stdout: string, stderr: string, exitCode: number, command: string}>}
     */
    exec(args: string[], options?: {}): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
        command: string;
    }>;
    /**
     * Create a new branch
     * @param {string} name
     */
    createBranch(name: string): Promise<void>;
    /**
     * Add all changes and commit
     * @param {string} message
     */
    commitAll(message: string): Promise<void>;
    /**
     * Rename current branch
     * @param {string} newName
     */
    renameBranch(newName: string): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
        command: string;
    }>;
    /**
     * Push branch to remote
     * @param {string} name
     */
    push(name: string): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
        command: string;
    }>;
    /**
     * Get the current branch name
     * @returns {Promise<string>}
     */
    getCurrentBranch(): Promise<string>;
}
