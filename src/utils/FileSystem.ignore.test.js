import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { FileSystem } from './FileSystem.js'

describe('FileSystem.browse – default ignore handling (bug fix)', () => {
	let tempDir
	/** @type {FileSystem} */
	let fileSystem

	before(async () => {
		// Create a temporary workspace
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-ignore-test-'))
		fileSystem = new FileSystem({ cwd: tempDir })

		// Structure as described in the task
		await fs.mkdir(path.join(tempDir, '.git'), { recursive: true })
		await fs.writeFile(path.join(tempDir, '.git', 'CONFIG'), 'git config')

		await fs.mkdir(path.join(tempDir, 'bank', 'node_modules', 'some'), { recursive: true })
		await fs.writeFile(path.join(tempDir, 'bank', 'node_modules', 'some', 'thing.js'), '// dummy')

		await fs.mkdir(path.join(tempDir, 'node_modules', '@nan0web', 'db'), { recursive: true })
		await fs.writeFile(path.join(tempDir, 'node_modules', '@nan0web', 'db', 'package.json'), '{}')
		await fs.writeFile(path.join(tempDir, 'node_modules', '@nan0web', 'db', 'index.js'), 'module.exports = {}')

		await fs.writeFile(path.join(tempDir, 'package.json'), '{}')
		await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
		await fs.writeFile(path.join(tempDir, 'src', 'index.js'), '// entry')
	})

	after(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it('should return only non‑ignored files', async () => {
		const results = await fileSystem.browse('.', {
			recursive: true,
			ignore: ['.git', 'node_modules'],
		})

		const expected = ['package.json', 'src/index.js']
		assert.deepStrictEqual(results.filter(s => !s.endsWith(fileSystem.path.sep)).sort(), expected.sort())
	})
})
