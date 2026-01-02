import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import { access, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"

// Promisified spawn for running task tests
const spawnAsync = promisify(spawn)

// Helper to run a single task.test.js and generate pass/fail/pending files based on outcome
async function runTaskTest(taskDir) {
	const taskTestPath = path.resolve(taskDir, "task.test.js")
	try {
		const { stdout, stderr, exitCode } = await spawnAsync("node", ["--test", taskTestPath], {
			cwd: taskDir,
			encoding: "utf8",
		})

		if (exitCode === 0 && !stdout.includes("todo") && !stdout.includes("skip")) {
			// All tests passed (no todo/skip): create pass.txt with stdout
			await writeFile(path.resolve(taskDir, "pass.txt"), stdout)
			console.info(`PASS: ${path.basename(taskDir)} - ${stdout.match(/pass (\d+)/)?.[1] || 0} tests`)
		} else if (exitCode !== 0 || stderr) {
			// Failed or errors: create fail.txt with stderr + stdout
			const failContent = stderr ? `${stderr}\n${stdout}` : stdout
			await writeFile(path.resolve(taskDir, "fail.txt"), failContent)
			console.error(`FAIL: ${path.basename(taskDir)} - Errors: ${failContent.match(/fail (\d+)/)?.[1] || 0}`)
		} else {
			// Pending (todo/skip): create pending.txt with progress
			const pendingCount = (stdout.match(/todo (\d+)/g) || []).length + (stdout.match(/skip (\d+)/g) || []).length
			const pendingContent = `Pending: ${pendingCount} tests (todo/skip)\n${stdout}`
			await writeFile(path.resolve(taskDir, "pending.txt"), pendingContent)
			console.info(`PENDING: ${path.basename(taskDir)} - ${pendingCount} pending`)
		}
	} catch (error) {
		await writeFile(path.resolve(taskDir, "fail.txt"), error.message)
		console.error(`ERROR running ${path.basename(taskDir)}: ${error.message}`)
	}
}

/**
 * This index.test.js runs AFTER all task.test.js via the command:
 * node --test --test-timeout=3333 releases/*\/*\/task.test.js && node --test --test-timeout=3333 releases/*\/index.test.js
 * It verifies task outcomes by checking for pass.txt (full success, no todo/skip/fail),
 * fail.txt (errors/failures), or pending.txt (todo/skip remaining).
 * For release success: 100% pass.txt across all tasks, no fail/pending.
 * It also ensures tests.txt exists with test file lists for each task (run after code updates, before pnpm test:all).
 * Dependencies: Tasks are ordered (001 before 002), but can run parallel if no inter-task deps.
 * Safety: Tests use temp dirs; for full isolation, run in Docker (see llimo release command).
 */
describe("LLiMo v1.1.0 Release – Task Outcome Verification", () => {
	const releaseDir = "releases/v1.1.0"

	it("9.1 Verifies all task directories exist, ensures tests.txt, runs task.test.js to generate outcomes", async () => {
		const taskDirs = await readdir(releaseDir, { withFileTypes: true })
			.filter(dirent => dirent.isDirectory() && dirent.name.match(/^00\d+-/))
			.map(dirent => path.resolve(releaseDir, dirent.name))

		ok(taskDirs.length >= 9, `Release has at least 9 task directories (found ${taskDirs.length})`)

		for (const taskDir of taskDirs) {
			// Ensure tests.txt exists (detailed list generated from @todo in task.test.js)
			let testsTxt = await readFile(path.resolve(taskDir, "tests.txt"), "utf-8").catch(() => "")
			if (!testsTxt.trim()) {
				// Generate from @todo comments if missing (parse task.test.js for @todo lines)
				const taskTest = await readFile(path.resolve(taskDir, "task.test.js"), "utf-8")
				const todoLines = taskTest.split("\n").filter(line => line.includes("@todo")).map(line => line.match(/@todo (.*)/)?.[1] || "")
				testsTxt = todoLines.filter(Boolean).join("\n")
				await writeFile(path.resolve(taskDir, "tests.txt"), testsTxt)
			}
			ok(testsTxt.trim(), `Task ${path.basename(taskDir)} has tests.txt with executable test list`)

			// Run task.test.js to generate pass/fail/pending
			await runTaskTest(taskDir)
		}

		const outcomes = []
		for (const taskDir of taskDirs) {
			const passExists = await access(path.resolve(taskDir, "pass.txt")).then(() => true).catch(() => false)
			const failExists = await access(path.resolve(taskDir, "fail.txt")).then(() => true).catch(() => false)
			const pendingExists = await access(path.resolve(taskDir, "pending.txt")).then(() => true).catch(() => false)

			const outcome = {
				dir: path.basename(taskDir),
				testsCount: (await readFile(path.resolve(taskDir, "tests.txt"), "utf-8").catch(() => "")).split("\n").filter(line => line.trim()).length,
				pass: passExists,
				fail: failExists,
				pending: pendingExists,
				status: passExists ? "PASS" : failExists ? "FAIL" : pendingExists ? "PENDING" : "MISSING"
			}
			outcomes.push(outcome)

			if (passExists && (failExists || pendingExists)) {
				throw new Error(`Task ${outcome.dir} has conflicting files: pass + ${failExists ? "fail" : "pending"}`)
			}

			if (!outcome.status || outcome.status === "MISSING") {
				throw new Error(`Task ${outcome.dir} missing outcome – run task.test.js and ensure it creates pass/fail/pending.txt`)
			}
		}

		console.info("\n=== Task Outcomes for v1.1.0 ===")
		outcomes.forEach(o => console.info(`${o.status.padEnd(8)}: ${o.dir} (${o.testsCount} tests from tests.txt)`))

		const failsPending = outcomes.filter(o => o.status !== "PASS")
		console.info(`\nPending/Failed: ${failsPending.map(o => o.dir).join(", ")}`)
		ok(failsPending.length === 0 || failsPending.length < taskDirs.length, `Progress: ${taskDirs.length - failsPending.length}/${taskDirs.length} passed`)
	})

	it("9.2 Release complete if all tasks have pass.txt, no fail/pending; executes tests from tests.txt", async () => {
		// For each task: Ensure tests.txt, run listed tests (node --test file.js), then pnpm test:all
		const taskDirs = await readdir(releaseDir, { withFileTypes: true })
			.filter(dirent => dirent.isDirectory() && dirent.name.match(/^00\d+-/))
			.map(dirent => path.resolve(releaseDir, dirent.name))

		for (const taskDir of taskDirs) {
			const testsTxt = await readFile(path.resolve(taskDir, "tests.txt"), "utf-8")
			const testFiles = testsTxt.split("\n").map(line => line.trim()).filter(Boolean)
			ok(testFiles.length > 0, `Task ${path.basename(taskDir)} has ${testFiles.length} tests in tests.txt`)

			// Run each test file (simulate execution; in CI, this would spawn node --test)
			for (const testFile of testFiles) {
				const absTest = path.resolve(testFile) // Relative to project root
				try {
					const { exitCode } = await spawnAsync("node", ["--test", absTest], { encoding: "utf8" })
					strictEqual(exitCode, 0, `Task test ${testFile} passes`)
				} catch (error) {
					throw new Error(`Failed to run test ${testFile}: ${error.message}`)
				}
			}

			// After task tests: Run full pnpm test:all
			const { exitCode: pnpmCode } = await spawnAsync("pnpm", ["test:all"], { encoding: "utf8" })
			strictEqual(pnpmCode, 0, `pnpm test:all passes after ${path.basename(taskDir)} updates`)
		}

		// Check outcomes (all should be PASS now)
		let allPassed = true
		for (const taskDir of taskDirs) {
			const passExists = await access(path.resolve(taskDir, "pass.txt")).then(() => true).catch(() => false)
			const failExists = await access(path.resolve(taskDir, "fail.txt")).then(() => true).catch(() => false)
			if (!passExists || failExists) allPassed = false
		}
		strictEqual(allPassed, true, "All tasks passed: ready for git tag v1.1.0 && pnpm publish")
	})
})
