/**
 * Path operations wrapper
 */
export default class Path {
    /**
     * Get directory name
     * @param {string} path
     * @returns {string}
     */
    dirname(path: string): string;
    /**
     * Get file extension
     * @param {string} path
     * @returns {string}
     */
    extname(path: string): string;
    /**
     * Resolve path
     * @param {...string} paths
     * @returns {string}
     */
    resolve(...paths: string[]): string;
    /**
     * Solve the relative path from {from} to {to} based on the current working directory.
     * At times we have two absolute paths, and we need to derive the relative path from one to the other. This is actually the reverse transform of path.resolve.
     *
     * @param {string} from
     * @param {string} to
     * @returns {string}
     * @throws {TypeError} if either `from` or `to` is not a string.
     */
    relative(from: string, to: string): string;
    /**
     * Get basename
     * @param {string} path
     * @returns {string}
     */
    basename(path: string): string;
}
