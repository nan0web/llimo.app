# llimo release Command (v1.1.0)

Implement `llimo release <release-path>` for parallel task execution in git branches/temp worktrees.

**Requirements:**
- Parse NOTES.md → tasks list (ReleaseProtocol.parse).
- Per task: git checkout -b v2.0.0.${id}, git worktree add /tmp/task-${id}, cd temp → llimo chat task.md --new, pnpm test:all → pass/fail.txt.
- Fail→todo() tests, retry chat (fix-fail.txt), max 9 attempts.
- Success→copy releases/... back, git commit/merge.
- Parallel: Promise.allSettled(tasks.slice(0,threads=4)).
- Stats: `llimo stats` → table branch|status (complete/fail N/9).

Create: src/release/ReleaseCommand.js (worktree/loop), bin/stats.js.

Tests: releases/1/v1.1.0/001-Release-Workflow/task.test.js (mock git/spawn, assert outcomes).
