# LLiMo Features

## Core Features (v1.0.0 - Implemented)

1. **CLI Entry Point (bin/llimo-chat.js)**: Main command for chat initiation, supporting `llimo me.md` (file input with attachments), `llimo` (interactive readline), or `echo "prompt" | llimo` (stdin stream). Packs me.md content/blocks (`---` separators) and file refs into prompt.
2. **Options Parsing (src/Chat/Options.js)**: Handles `--new`, `--yes`, `--test --test-dir=dir`, `--model=ID`, `--provider=PROV` via parseArgv. Defaults: isNew=false, isYes=false, etc. Validation for booleans/strings.
3. **Model Management (src/llm/AI.js, src/Chat/models.js)**: Loads models from providers (OpenAI, Cerebras, HuggingFace, OpenRouter) with caching (1h TTL). Progress UI during load. Select by partial ID/provider interactively or direct.
4. **FileProtocol & Parsing (src/FileProtocol.js, src/utils/Markdown.js)**: Parses markdown responses to ParsedFile (correct files, failed errors, @validate). Supports JSONL with safeParse for escaped newlines. Validates files vs @validate list (isValid flag).
5. **Chat Persistence (src/llm/Chat.js)**: UUID-based dirs in `/chat/ID/`, saves messages.jsonl, loads history. Supports init, add, save/load (prompt.md, input.md, usage.json, etc.).
6. **UI & Progress (src/cli/*, src/llm/chatProgress.js)**: ANSI colors, overwriteLine/cursorUp for streaming progress (reading/reasoning/answering phases). formatChatProgress: padded table with tokens/speeds/costs (no NaN via safeSpent/safeSpeed). Interactive prompts (askYesNo: y/empty→yes, n→no).
7. **Commands (src/llm/commands/*)**: @bash (append to prompt.md), @get/@ls (file lists with globs/ignores), @rm (remove files), @summary (context message), @validate (file/command count). Extend with examples; run yields console lines.
8. **Packing/Unpacking (src/llm/pack.js, src/llm/unpack.js)**: packMarkdown: bundles refs/globs (`- [](src/**)`) into prompt MD (#### [label](file) ```type\ncontent```). unpackAnswer: extracts to files/commands, dry-run mode.
9. **Test Mode (src/llm/TestAI.js)**: Simulates AI with log files (answer.md, chunks.jsonl, messages.jsonl, etc.). Handles per-step (step001/), falls back empty. Integrates with --test --test-dir.
10. **System Prompt (src/llm/system.js, src/templates/system.md)**: Generates MD with tools list (@validate, @bash, etc.) and instructions. bin/llimo-system for output/save.

## v1.1.0 Features (Planned/Partial)

1. **File Attachments via ai-sdk (New)**: Support text/audio/video in prompts via ai-sdk protocols. For audio (.mp3/.m4a): generate @bash script for Whisper transcription (OpenAI/OpenRouter/HF, env vars), unpack to .txt. Vision: Analyze images (e.g., pictures/** → video storyboard via model).
   - Create: src/llm/commands/AudioTranscribeCommand.js, src/llm/ai-sdk-integration.js.
   - Tests: src/llm/ai-sdk.test.js (mock upload/transcribe), bin/llimo-chat.test.js (audio ref in me.md → script + .txt output).
   - Deps: ai-sdk tools (file upload, vision), glob for directories.
   - Security: Validate file types/sizes (<10MB), sandbox transcription (temp dir).

2. **Chat Archiving & Management**: On --new: Archive old chat to `/archive/<short-hash>/chat.zip + chat.json` (UUID → base36 short ID). llimo ls: Table of recent/current chats (title/size/tokens/cost), keypress filter. Resume: llimo ls → select → unzip to /chat/ID, update current.
   - Create: src/llm/ChatArchive.js (shortID gen, zip/unzip via adm-zip), src/cli/ChatLs.js (interactive table/filter).
   - Tests: src/llm/ChatArchive.test.js (UUID→short, zip integrity), bin/llimo-ls.test.js (mock stdin for select/filter).
   - Deps: 5.1 (Chat init), external: adm-zip pnpm add.
   - Security: Validate zip extracts (no exec), hash collisions, dir traversal in unzip.

3. **Commands Enhancement**: @title (first response: laconical title in user's lang). @inject (expand globs to checklists in response). @info (chat stats: usage/tokens/cost).
   - Create: src/llm/commands/TitleCommand.js, src/llm/commands/InjectCommand.js, src/llm/commands/InfoCommand.js.
   - Tests: src/llm/commands/Title.test.js (mock first response → title.md), src/llm/commands/Inject.test.js (glob → checklist lines), src/llm/commands/Info.test.js (parse usage → table).
   - Deps: 7.3 (command base), 5.6 (info stats).
   - Security: Sanitize titles (no MD injection), limit inject globs (no ../).

4. **Release Workflow (releases/v1.1.0)**: Tasks in 00X-Name/task.test.js (detailed @todo English: files to create, tests cover). tests.txt list. Run: node --test */task.test.js (gen pass/fail/pending.txt). index.test.js verifies outcomes (all pass for release). llmo release: Background multi-thread (Promise.allSettled), Docker isolation.
   - Create: bin/llimo-release.js (read tasks, parallel exec, Docker via child_process).
   - Tests: releases/v1.1.0/ReleaseWorkflow.test.js (spawn llmo release, mock Docker, assert outcomes).
   - Deps: All tasks (self-contained).
   - Security: Docker --rm, volume mounts limited, vulnerability scans (mock slither for JS?).

5. **Vulnerability Testing**: Add tests for path traversal (../ in refs/paths), injection (user input in prompts/files), DoS (large inputs/files >10MB truncate), API key leaks (env masking in logs).
   - Create: src/security/VulnTest.js (fuzz paths, scan for secrets).
   - Tests: src/security/VulnTest.test.js (assert blocks ../, truncates large, masks keys).
   - Deps: 1.3 (attachments), 6.2 (prompts).
   - Security: Integrate safe-path (pnpm add safe-path), env filter.

6. **Audio/Video Integration (ai-sdk)**: me.md refs audio/video → @bash gen script (Whisper for audio → .txt; vision for images/video → analysis). Unpack: transcripts/storyboards to files.
   - Create: src/llm/commands/MediaCommand.js (detect mp3/m4a/mp4, gen script with env vars).
   - Tests: src/llm/Media.test.js (mock ai-sdk upload/transcribe, verify script + .txt).
   - Deps: 1.1 (attachments), ai-sdk (pnpm add @ai-sdk/openai-vision).
   - Security: Temp dirs for media, size limits, no exec in unpack.

7. **Dependencies & Parallelism**: Tasks ordered (001→002 deps), but parallel if independent (e.g., commands/UI). llmo release: Promise.allSettled(tasks.map(runTask)), log progress.
   - Create: src/release/ParallelRunner.js (workers via threads? or simple Promises).
   - Tests: src/release/Parallel.test.js (mock tasks, assert parallel exec without deps).
   - Deps: N/A (workflow).

8. **Safety/Containerization**: llmo release --docker: Run tasks in Docker (alpine-node, mount src, --rm). Vuln tests: Scan for path inj, secrets (e.g., no API keys in git).
   - Create: bin/docker-task-run.sh (Docker exec template), src/security/SafetyScan.js.
   - Tests: src/security/Safety.test.js (mock Docker spawn, assert isolated run).
   - Deps: 4 (release cmd).
   - Security: Core (path.resolve, file limits).

9. **Missing from v1.0.0 → v1.1.0**: ls/info/delete/clear (from spec, not in v1.0), ai-sdk media tools, short IDs (base36), release workflow.
   - v1.0.0: Add implemented as "done" in changelog.
   - v1.1.0: Full spec coverage, Docker safety, vuln tests.

## v1.2.0+ (Future)
- Multi-modal (full video gen via ai-sdk).
- Parallel chats, advanced archiving (S3 or other clouds or database agnostic?).
- Extend `streamText` to ai-sdk file tools: Text (inline), Audio (transcribe on ref like story.mp3 → .txt), Vision (analyze image/dir → description).
- Command: @media audio.mp3 → gen @bash "node batch-transcribe-api audio.mp3" (Whisper-1, lang=uk, env) or through OpenRouter providers or others available models with such modality.
- Deps: Install @ai-sdk/openai-vision, mock for tests.


