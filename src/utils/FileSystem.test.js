import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { FileSystem } from './FileSystem.js'

describe('FileSystem.browse', () => {
	let tempDir
	/** @type {FileSystem} */
	let fileSystem

	before(async () => {
		// Create a unique temporary directory
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-browse-test-'))
		fileSystem = new FileSystem({ cwd: tempDir })

		// Create a test directory structure
		await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1')
		await fs.mkdir(path.join(tempDir, 'dir1'))
		await fs.writeFile(path.join(tempDir, 'dir1', 'file2.txt'), 'content2')

		await fs.mkdir(path.join(tempDir, 'node_modules'))
		await fs.mkdir(path.join(tempDir, 'node_modules', 'some-package'))
		await fs.writeFile(path.join(tempDir, 'node_modules', 'some-package', 'index.js'), 'module')

		await fs.mkdir(path.join(tempDir, 'dir2'))
		await fs.mkdir(path.join(tempDir, 'dir2', 'subdir'))
		await fs.writeFile(path.join(tempDir, 'dir2', 'subdir', 'file3.txt'), 'content3')

		// Create more files for glob pattern testing
		await fs.writeFile(path.join(tempDir, 'test.js'), 'test')
		await fs.writeFile(path.join(tempDir, 'test.ts'), 'typescript')
		await fs.mkdir(path.join(tempDir, '.git'))
		await fs.writeFile(path.join(tempDir, '.git', 'config'), 'git config')
		await fs.mkdir(path.join(tempDir, 'dist'))
		await fs.writeFile(path.join(tempDir, 'dist', 'bundle.js'), 'bundled')
	})

	after(async () => {
		// Clean up the temporary directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it('should list top-level entries when not recursive', async () => {
		const results = await fileSystem.browse('.', { recursive: false })
		const expected = ['file1.txt', 'dir1/', 'node_modules/', 'dir2/', 'test.js', 'test.ts', '.git/', 'dist/']
		assert.deepStrictEqual(results.sort(), expected.sort())
	})

	it('should list all entries recursively', async () => {
		const map = new Map()
		const onRead = async (dir, entries) => {
			map.set(dir, entries)
		}
		const results = await fileSystem.browse('.', { recursive: true, onRead })
		const expected = [
			'file1.txt',
			'dir1/',
			'dir1/file2.txt',
			'node_modules/',
			'node_modules/some-package/',
			'node_modules/some-package/index.js',
			'dir2/',
			'dir2/subdir/',
			'dir2/subdir/file3.txt',
			'test.js',
			'test.ts',
			'.git/',
			'.git/config',
			'dist/',
			'dist/bundle.js'
		]
		assert.deepStrictEqual(map, new Map([
			[".", [
				'.git',
				'dir1',
				'dir2',
				'dist',
				'file1.txt',
				'node_modules',
				'test.js',
				'test.ts',
			]],
			['.git', ['.git/config']],
			['dir1', ['dir1/file2.txt']],
			['dir2', ['dir2/subdir']],
			['dir2/subdir', ['dir2/subdir/file3.txt']],
			['dist', ['dist/bundle.js']],
			['node_modules', ['node_modules/some-package']],
			['node_modules/some-package', ['node_modules/some-package/index.js']],
		]))
		assert.deepStrictEqual(results.sort(), expected.sort())
	})

	it('should ignore specified directories', async () => {
		const results = await fileSystem.browse('.', { recursive: true, ignore: ['node_modules', 'dir2'] })
		const expected = [
			'file1.txt',
			'dir1/',
			'dir1/file2.txt',
			'test.js',
			'test.ts',
			'.git/',
			'.git/config',
			'dist/',
			'dist/bundle.js'
		]
		assert.deepStrictEqual(results.sort(), expected.sort())
	})

	it('should call onRead for each traversed directory', async () => {
		const readDirs = []
		const onRead = async (dir, entries) => {
			readDirs.push({ dir, count: entries.length })
		}

		await fileSystem.browse('.', { recursive: true, ignore: ['node_modules'], onRead })

		const expected = [
			{ dir: '.', count: 7 }, // file1.txt, dir1, dir2, test.js, test.ts, .git, dist
			{ dir: 'dir1', count: 1 }, // file2.txt
			{ dir: 'dir2', count: 1 }, // subdir
			{ dir: 'dir2/subdir', count: 1 }, // file3.txt
			{ dir: '.git', count: 1 }, // config
			{ dir: 'dist', count: 1 } // bundle.js
		]

		assert.deepStrictEqual(readDirs.sort((a, b) => a.dir.localeCompare(b.dir)), expected.sort((a, b) => a.dir.localeCompare(b.dir)))
	})

	it('should support glob patterns in ignore', async () => {
		const results = await fileSystem.browse('.', {
			recursive: true,
			ignore: ['*.js', 'node_modules/**', '.git/**', 'dist/**']
		})
		const expected = [
			'file1.txt',
			'dir1/',
			'dir1/file2.txt',
			'dir2/',
			'dir2/subdir/',
			'dir2/subdir/file3.txt',
			'test.ts'
		]
		assert.deepStrictEqual(results.sort(), expected.sort())
	})

	it('should ignore directories with glob patterns', async () => {
		const results = await fileSystem.browse('.', { recursive: true, ignore: ['dir*', '.*'] })
		const expected = [
			'file1.txt',
			'node_modules/',
			'node_modules/some-package/',
			'node_modules/some-package/index.js',
			'test.js',
			'test.ts',
			'dist/',
			'dist/bundle.js'
		]
		assert.deepStrictEqual(results.sort(), expected.sort())
	})

	it('should handle complex ignore patterns', async () => {
		const results = await fileSystem.browse('.', {
			recursive: true,
			ignore: ['**/file3.txt', 'test.*', 'dist/**']
		})
		const expected = [
			'file1.txt',
			'dir1/',
			'dir1/file2.txt',
			'node_modules/',
			'node_modules/some-package/',
			'node_modules/some-package/index.js',
			'dir2/',
			'dir2/subdir/',
			'.git/',
			'.git/config'
		]
		assert.deepStrictEqual(results.sort(), expected.sort())
	})
})



