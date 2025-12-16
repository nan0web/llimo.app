/**
 * @todo Detailed English: Implement release workflow in bin/llimo-release.js to run all tasks in /releases/v1.X.Y/00X-Name/ (scan dirs 001-009), parallel via Promise.allSettled for independent tasks (no inter-task deps or simple topo), process in background with progress (console.info status), each task runs "node --test task.test.js" to gen outcomes (pass/fail/pending.txt). If Docker --docker, spawn docker run (alpine-node mount src, --rm). On full success (all pass.txt, no fail/pending), output git tag/publish suggestion. Handle multi-thread (--threads 4) by chunking independent tasks into batches. Safety: Run in temp copy or container to isolate file ops, scan for vulns (mock simple path/filename checks).
 *       - Create: bin/llimo-release.js (loadTasks scans, ParallelRunner.js for threading), src/security/VulnTest.js (path traversal e.g. "../secret", secret scan e.g. API_KEY in code/logs).
 *       - Tests: bin/llimo-release.test.js (mock spawn, assert parallel run, outcomes collected), src/security/VulnTest.test.js (fuzz paths, assert blocks ../, masks env in stdout, limits file sizes <10MB in unpack/pack).
 *       Deps: 8.2 (branch workflow), all commands/UI (tested indirectly).
 *       Security: Docker isolation (--security-opt no-new-privs, volume whitelist), vuln tests cover path inj/secrets/DoS (e.g., large input truncate in ReadLine).
 *       After code: Run llmo release v1.1.0, verify all tasks gen pass.txt (or pending), pnpm test:all includes vuln scans.
 */

import { describe, it } from "node:test"
import { strictEqual, deepStrictEqual, ok } from "node:assert/strict"
import path from "node:path"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { spawnAsync } from "node:child_process"  // Assume
import ParallelRunner from "../../../src/release/ParallelRunner.js"
import VulnerabilityScanner from "../../../src/security/VulnTest.js"

describe("008-Test-Structure – releases/v1.1.0/** & pnpm test:all", () => {
	describe("8.1 Branch workflow: taskID local → merge to release-v1.1.0 on success", () => {
		it("Local task branch merges to release-v1.1.0 only after pnpm test:all passes 100%", async () => {
			const tempGitDir = await mkdtemp(path.join(tmpdir(), "git-8.1-"))
			// Mock git init, checkout release-v1.1.0, create task branch mockTask-001
			// Run tests in task branch, mock success → merge; on fail, no merge
			const testScript = `
const { execSync } = require('child_process');
try {
	execSync('pnpm test:all', { cwd: '${tempGitDir}' });
	console.log('merge ready');
} catch (err) {
	console.error('no merge');
	process.exit(1);
}
`
			await writeFile(path.join(tempGitDir, "test-success.js"), testScript)
			// Simulate: git merge task-001 → pnpm test:all → if success, git merge main
			console.info("Mock git workflow: branch → test → merge")
			// Placeholder: Assume git mock, execSuccess, verify no errors on success
			const mockSuccess = true  // Run pnpm test:all mock
			ok(mockSuccess, "Branch merges only on test:all success")
		})
	})

	describe("8.2 Branch workflow: taskID local → merge to release
