# Instruction for LLiMo Release Management and Task Execution

This instruction guides programmers on structuring releases, tasks, tests, and safe execution. Follow strictly for consistency when implementing v1.0.0 (base implemented features) and v1.1.0 (new features). All @todo comments must be in English, detailed, and actionable. Tests are isolated (temp dirs), and the workflow ensures secure/parallel execution.

## 1. Release Structure (releases/vX.Y.Z/)

Releases are directories containing task groups (e.g., v1.0.0, v1.1.0). Each group is a self-contained unit:

- `releases/vX.Y.Z/index.test.js`: **Verification Script**. Runs after task.test.js; checks all outcomes (pass/fail/pending.txt in groups). Success: All PASS, no FAIL (100% tests passed). Logs outcomes to console; runs tests from tests.txt first.
- `releases/vX.Y.Z/001-Feature-Name/`: **Task Group Directory**. One per logical feature/group (numbered for order).
  - `task.test.js`: **Core Task Tests**. Contains it() for sub-tasks (e.g., "1.1 Handle CLI"). Each it() verifies implementation (initially todo() fails; implement → it(), run → pass.txt on success, no todo/skip; fail → fail.txt).
  - `tests.txt`: Plaintext list of project tests (e.g., "src/mod.test.js") activated after implementing this group. These run to ensure no regressions in existing code.
  - `pass.txt`: Created by index.test.js if task.test.js 100% passes (stdout summary).
  - `fail.txt`: Created by index.test.js if task.test.js fails (stderr + errors).
  - `pending.txt`: Created by index.test.js if task.test.js has todo/skip (progress: # todo/skipped).

**Run Workflow**:
- `node --test releases/vX.Y.Z/00X-Name/tests.txt`: Run group-specific project tests (after code implementation).
- `node --test releases/vX.Y.Z/00X-Name/task.test.js`: Run individual task (generates pass/fail/pending.txt).
- `pnpm test:all`: Full project tests; required for merge to release branch.
- `node --test releases/vX.Y.Z/index.test.js`: Holistic check (all pass.txt, no fail/pending).

**Branch Management**: 
- Release branch: `git checkout release-v1.1.0` (protected, only merge tasks on 100% pass).
- Task branches: Local only (e.g., `git checkout -b task-001-core from release-v1.1.0`), merge to release branch on pass (no merge on fail).
- On success: Merge task to release-v1.1.0 after pnpm test:all 100%.
- Release complete: All tasks PASS → tag vX.Y.Z, pnpm publish.

**Dependencies**: Declare in @todo (English): "Deps: 001 (parsing)" to order tasks (e.g., UI depends on 001 but can parallel commands).

## 2. Task.test.js Format (English @todo)

Each task.test.js has describe/it structured for incremental implementation:

- **Top-Level describe**: Group name (e.g., "001-Core-Chat-Functionality – bin/llimo-chat.js as main CLI entry point").
- **Nested describe**: Sub-feature (e.g., "1.1 Implement basic CLI handling: cd...").
- **it.todo("Sub-task: Description", async () => { /* @todo detailed English: steps to implement, expected inputs/outputs, edge cases. Create files: - bin/llimo-chat.js (add cd logic). Tests: bin/llimo-chat.test.js (spawn cd/pack). Deps: None. Security: Use path.resolve on paths/argv to block '../' traversal; limit stdin buffers. */ })**: Detailed, actionable. If pending, it.todo() fails gracefully; implement to it() with assertions.
- **Sub-it()**: Concrete verification (e.g., assert packed prompt includes file).

**@todo Guidelines**:
- **Detailed English**: Precise, self-contained. E.g., "Implement function X in src/mod.js to Y (input string → output object; throw Error on invalid Z). Handle edge: empty string → default empty obj. Security: Sanitize user input with escape() to prevent injection."
- **Files to Create**: List new/modified (e.g., "Create: - src/mod.js, - src/mod.test.js").
- **Tests to Cover**: Existing tests that should pass (e.g., "Cover with tests: - src/mod.test.js (100% export coverage).").
- **Deps**: Link to prior groups (e.g., "Deps: 001 (Chat init required for parsing).").
- **Security**: Always include. E.g., "Security: Validate file paths with path.resolve(cwd, input) to prevent directory traversal; limit file size to 10MB to avoid DoS; sanitize filenames (no '/', '\\', mal chars)."
- **After Implementation**: Turn it.todo() → it(); if unfixable, it.skip() after max iterations (log reasoning in comments).

## 3. tests.txt for Task Groups

After updating code for a task, run tests in `./tests.txt` to verify incrementally (before full pnpm test:all). Format:

```
# Tests to run after implementing this task
# Run: node --test $(cat tests.txt)
src/llm/Chat.test.js    # Verify updated load/save
src/cli/argvHelper.test.js # CLI arg validation
bin/llimo-chat.test.js  # Integration: spawn CLI with me.md → unpacked files correct
src/security/PathVuln.test.js # Security: Block ../ escapes in paths/refs
# Add more as task needs (e.g., new command → new command.test.js)
```

- **Run Command**: `node --test --test-timeout=3333 $(cat releases/vX.Y.Z/001-Name/tests.txt)` (runs listed tests, catches regressions).
- **Update Process**: If tests fail, fix code, rerun, update pass.txt on success.
- **Types/Size**: Include security tests (e.g., vuln scans).

## 4. Dependency Management Across Groups

Tasks depend on prior (numbered): 001-Core before 002-Options (uses parsed args). llimo release uses simple topological sort (run independent first, then deps).

- **Independent**: UI (006), Commands (007), Security (in 008).
- **Dependent**: 005-Chat (on 001), 008-Tests (on all).
- **In @todo**: Always note deps (e.g., "Deps: 002-Options-Handling (argv parsing for --new).").
- **Parallel Execution**: In llimo release (008), use Promise.allSettled for non-dep tasks (e.g., UI parallel to Commands).

## 5. Full Execution Sequence for Releases

1. **Check the code**: `pnpm test:all`, if `exitCode !== 0` throw the Error.
1. **Initialize Release Branch**: `git checkout -b release-v1.1.0`
1. **For Each Task (Parallel Possible)**:
   - `git checkout -b task-001-core from release-v1.1.0`
   - Read @todo in task.test.js (details, files to create).
   - Create/update code files.
   - Run: `node --test $(cat releases/v1.1.0/001-Core-Chat-Functionality/tests.txt)` (separate new models, components testss)
     - If fail: Fix → rerun.
     - On success: `node --test releases/v1.1.0/001-Core-Chat-Functionality/task.test.js` (task validation).
     - All pass? `pnpm test:all` (full coverage).
1. **Merge on Success**: `git checkout release-v1.1.0; git merge task-001-core` (if no conflicts).
1. **Verify Release**: `node --test releases/v1.1.0/index.test.js` (checks all pass.txt, runs tests.txt, pnpm test:all).
   - If all PASS: Release ready; run `llimo release v1.1.0` for automated multi-thread/Docker run.
1. **Release Complete**: All groups PASS → `git tag v1.1.0; pnpm publish`. Update changelog.

## 6. files.txt for Task-Specific Chats

For minimal chat reproduction (e.g., create separate chat with `llimo files.txt prompt.txt`):

- **Format**: 
```
# Essential files for this task/chat (copy to temp dir for isolated reproduction)
me.md:
This is the pre-prompt for the task. Include markdown refs: - [](src/mod.js)

# Copy these project files too
src/llm/Chat.js          # Core chat save/load affected
src/cli/argvHelper.js     # CLI parsing for --new
ptn: src/**/*.test.js     # Glob for related tests (exclude in .gitignore)
# Audio/Video for media tasks (e.g., 6. Audio/Vision Integration)
mock-audio/audio1.mp3         # Sample audio for transcription test
mock-visual/image1.jpg        # Sample image for vision test
```

- **Usage**: Copy listed to temp dir, run llimo to reproduce (e.g., injects for me.md attachments).
- **Why Minimal?**: For quick task chats without full project (load only needed for context).
- **Security**: files.txt paths are read with resolve(), still temp dirs in tests.

## 7. Security & Containerization

- **Isolation**: All tests use mkdir in tmpdir(), rm after. For CLI safety: path.resolve() on all loads/saves.
- **Vuln Tests**: In tests.txt or separate: src/security/PathScan.test.js (fuzz ""), src/security/SecretMask.test.js (no API keys in logs).
- **Docker**: In llimo release --docker: Spawn docker run --rm -v ${PWD}:/app -w /app node:20-alpine "node --test task.test.js" (limited bind mount /app only).
  - Benefits: Isolated FS (no rm project by mistake), consistent env, vuln isolation.
  - Run: `docker build -t llimo-task .` (Dockerfile with pnpm install deps).
- **Vuln Scanning**: Add npm run security: eslint-ban-unhandled, path fuzz (mock "..\0" → ENOENT).

## Next Step

Use this to implement tasks. For v1.0.0: Move implemented features there (e.g., core parsing). Run `node --test releases/v1.0.0/index.test.js` to verify baseline. For v1.1.0: Focus on new (@media, archiving, etc.). Total: 100% it() pass, no todo/skip.
