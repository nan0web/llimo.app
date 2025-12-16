#!/usr/bin/env node
/**
 * llmo release: Run all tasks in a release (e.g., v1.1.0) in background, parallel where possible.
 * Usage: llmo release v1.1.0 [--docker] [--threads 4]
 * - Parallel: Independent tasks via Promise.allSettled (no deps enforced).
 * - Docker: Run each task in isolated container (alpine-node, mount src, --rm).
 * - Progress: Log status (pending/doing/done), outcomes to pass/fail/pending.txt.
 * - On complete: If all pass, suggest git tag/publish.
 */

import process from "node:process"
import path from "node:path"
import { spawn } from "node:child_process"
import { promisify } from "node:util"
import { mkdir, readdir, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"

const spawnAsync = promisify(spawn)

/** Parallel runner: Exec tasks with deps respected (topo sort simple). */
class ParallelRunner {
	static async run(tasks, { threads = 4, docker = false }) {
		// Simple deps: Run independent first (no incoming deps)
		const indepTasks = tasks.filter(t => !t.deps?.length)
		const settled = await Promise.allSettled(indepTasks.map(t => this.execTask(t, { docker })))

		// Log
		settled.forEach((result, i) => {
			if (result.status === "fulfilled") console.info(`DONE: ${indepTasks[i].name}`)
			else console.error(`FAIL: ${indepTasks[i].name} - ${result.reason}`)
		})

		return settled
	}

	static async execTask(task, { docker = false }) {
		const taskDir = path.resolve("releases/v1.1.0", task.dir)
		console.info(`Running: ${task.name} (${docker ? "in Docker" : "native"})`)

		if (docker) {
			return this.runInDocker(taskDir)
		} else {
			return spawnAsync("node", ["--test", path.join(taskDir, "task.test.js")], { cwd: taskDir, encoding: "utf8" })
		}
	}

	static async runInDocker(taskDir) {
		const dockerImage = "node:20-alpine"
		const mount = `${process.cwd()}:/app`
		const cmd = "cd /app/releases/v1.1.0 && node --test task.test.js"
		return spawnAsync("docker", [
			"run", "--rm", "-v", mount, dockerImage, "sh", "-c", cmd
		], { cwd: path.dirname(taskDir), encoding: "utf8" })
	}
}

/** Load tasks from release dir (scan 00X-Name/, parse deps from tests.txt or comments). */
async function loadTasks(releaseVer) {
	const releaseDir = path.resolve("releases", releaseVer)
	const taskDirs = await readdir(releaseDir, { withFileTypes: true })
		.filter(d => d.isDirectory() && d.name.match(/^00\d+-/))

	return taskDirs.map(dir => ({
		dir: dir.name,
		name: dir.name.replace(/^00\d+-/, ""),
		path: path.resolve(releaseDir, dir.name),
		deps: [] // Parse from tests.txt deps line or @todo comments
	}))
}

/** Main CLI. */
async function main(argv = process.argv.slice(2)) {
	if (argv.length < 1) {
		console.error("Usage: llmo release <v1.1.0> [--docker] [--threads 4]")
		process.exit(1)
	}

	const releaseVer = argv[0]
	const docker = argv.includes("--docker")
	const threads = parseInt(argv.find(a => a.startsWith("--threads="))?.split("=")[1]) || 4

	const tasks = await loadTasks(releaseVer)
	console.info(`Running ${tasks.length} tasks in ${releaseVer} (${docker ? "Docker-isolated" : "native"}, ${threads} threads)`)

	const results = await ParallelRunner.run(tasks, { threads, docker })

	const passed = results.filter(r => r.status === "fulfilled").length
	console.info(`\nComplete: ${passed}/${tasks.length} passed. Run index.test.js to verify.`)
	if (passed === tasks.length) {
		console.info("All passed! Suggest: git tag v${releaseVer} && pnpm publish")
	}
}

main().catch(err => {
	console.error("Release execution failed:", err)
	process.exit(1)
})
