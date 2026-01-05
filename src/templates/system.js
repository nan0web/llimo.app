import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { FileSystem } from '../utils/FileSystem.js'

/**
 * Returns the system instructions.
 * @returns {Promise<string>} The system instructions in markdown format.
 */
export default async function getTemplate() {
	const fs = new FileSystem({ cwd: dirname(fileURLToPath(import.meta.url)) })
	return await fs.load("system.md", "utf-8")
}
