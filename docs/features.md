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

4. **Release Workflow (releases/1/v1.1.0)**: Tasks in 00X-Name/task.test.js (detailed @todo English: files to create, tests cover). tests.txt list. Run: node --test */task.test.js (gen pass/fail/pending.txt). index.test.js verifies outcomes (all pass for release). llmo release: Background multi-thread (Promise.allSettled), Docker isolation.
   - Create: bin/llimo-release.js (read tasks, parallel exec, Docker via child_process).
   - Tests: releases/1/v1.1.0/ReleaseWorkflow.test.js (spawn llmo release, mock Docker, assert outcomes).
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

10. **Auto file attachment**: check every file that were injected/returned in chat messages and inject in the prompt updated ones.

## v1.2.0+ (Future)
- Possible to load strategies to select a proper models based on a context and from `{system|agent|input}.md`, as configuration header in yaml format, for instance:
	```yaml
	strategy: [fastest cheapest](models.txt)
	```
- Multi-modal (full video gen via ai-sdk).
- Parallel chats, advanced archiving (S3 or other clouds or database agnostic?).
- Extend `streamText` to ai-sdk file tools: Text (inline), Audio (transcribe on ref like story.mp3 → .txt), Vision (analyze image/dir → description).
- Command: @media audio.mp3 → gen @bash "node batch-transcribe-api audio.mp3" (Whisper-1, lang=uk, env) or through OpenRouter providers or others available models with such modality.
- Deps: Install @ai-sdk/openai-vision, mock for tests.

## Hot-fix requests
- Handle JSONL formats from chat responses.
	```bash
	+ src/llm/chat-progress/standard/chat/da595208-098d-4c81-9742-2eaba468e3d8/input.md (32 bytes)
	❌ Fatal error in llimo‑pack: Error: JSONL accept only rows (array of any type of data)
	    at FileSystem._jsonlSaver (file:///Users/i/src/purejs/llimo.app/src/utils/FileSystem.js:305:11)
	    at FileSystem.save (file:///Users/i/src/purejs/llimo.app/src/utils/FileSystem.js:345:17)
	    at async unpackAnswer (file:///Users/i/src/purejs/llimo.app/src/llm/unpack.js:97:4)
	    at async main (file:///Users/i/src/purejs/llimo.app/bin/llimo-unpack.js:125:19)
	```
- Handle proper free token limits
	```bash
	% node bin/llimo-chat.js dev.md --new

	+ b0416d7c-2e49-4408-9615-e32c41d08738 new chat created
	+ system.md loaded 2,203b
	@ system instructions 7,128b
	@ Loaded 637 inference models from 3 providers
	> cerebras
	> huggingface
	> openrouter
	@ gpt-oss-120b @cerebras []
	  context: 0T (max output → 0T)
	  price: → $0.00 / 1M ← $0.00 / 1M
	+ dev.md (chat/b0416d7c-2e49-4408-9615-e32c41d08738/input.md)

	@ Step 1. 12/30/2025, 6:03:27 PM
	@ Model changed due to AiStrategy
	@ qwen/qwen-turbo @openrouter [text->text]
	  context: 1,000,000T (max output → 1,000,000T)
	  price: → $0.05 / 1M ← $0.20 / 1M (cache: $0.0200 / 1M)
	  Prompt: 707,074b | Chat: 713,310b ~ 198,142T ~ $0.0139 | Left: 801,858T of 1,000,000T | $0.00

	? Send prompt to LLiMo? (Y)es, No: 

	read | 1:03 | $0.0000 | 178,270T | 2,829T/sss/s
	chat | 1:03 | $0.0000 | 178,270T | 2,829T/s | 0T2025-12-30T16:04:09.000Z: Tokens per minute limit exceeded - too many tokens processed.
	2025-12-30T16:04:11.000Z: Tokens per minute limit exceeded - too many tokens processed.
	2025-12-30T16:05:10.000Z: Tokens per minute limit exceeded - too many tokens processed.
	  Retry after 2025-12-30T16:06:10.000Z

	+ answer (chat/b0416d7c-2e49-4408-9615-e32c41d08738/steps/001/answer.md)
	@ Extracting files (dry mode, no real saving)
	Unpack current package? (Y)es, No, ., <message>: 
	```

	> 2025-12-19T16:29:51.000Z: Tokens per minute limit exceeded - too many tokens processed.
	It is not visible during the progress that limit is exceeded.
	> 	Retry after 2025-12-19T16:31:52.000Z
	Must also or instead show `Retry in 30s after 2025-12-19 18:31:52`
- Handle non-free API limits error:
	```bash
	% node bin/llimo-chat.js dev.md --new --model gpt-oss-120b --provider huggingface/cerebras

	+ b0416d7c-2e49-4408-9615-e32c41d08738 new chat created
	+ system.md loaded 2,203b
	@ system instructions 7,128b
	@ Loaded 637 inference models from 3 providers
	> cerebras
	> huggingface
	> openrouter
	@ openai/gpt-oss-120b @huggingface/cerebras []
	  context: 200,000T (max output → 200,000T)
	  price: → $0.25 / 1M ← $0.69 / 1M
	+ dev.md (chat/b0416d7c-2e49-4408-9615-e32c41d08738/input.md)

	@ Step 1. 12/30/2025, 6:07:30 PM
	  Prompt: 705,849b | Chat: 712,085b ~ 197,801T ~ $0.0495 | Left: 2,199T of 200,000T | $0.00

	? Send prompt to LLiMo? (Y)es, No: 

	read | 0:00 | $0.0445 | 177,963T | 213,385T/s/s
	chat | 0:00 | $0.0445 | 177,963T | 213,385T/s | 22,037TAPI Error: Payload Too Large

	+ answer (chat/b0416d7c-2e49-4408-9615-e32c41d08738/steps/001/answer.md)
	@ Extracting files (dry mode, no real saving)
	Unpack current package? (Y)es, No, ., <message>: %
	```
- For small (silly) models check the response and if there are no files at all, throw error or use another larger model (smarter) or try to continue with next message `Follow the output format.`.
- If I use `- [@ls][src/**]` and then `- [](src/index.js)` prompt is not processing injections after listing.
- Remove progresses from piped execution:
	```bash
	% node bin/llimo-models.js >> models.md

	% cat models.md
	Loading models …

	[KLoading models @cerebras (0 in 0.03ms)
	[KLoading models @cerebras (0 in 0.061ms)
	[KLoading models @cerebras (0 in 0.092ms)
	[KLoading models @cerebras (0 in 0.123ms)
	[KLoading models @cerebras (0 in 0.154ms)
	[KLoading models @cerebras (0 in 0.185ms)
	[KLoading models @cerebras (0 in 0.217ms)
	[KLoading models @cerebras (0 in 0.247ms)
	[KLoading models @cerebras (0 in 0.279ms)
	[KLoading models @cerebras (0 in 0.318ms)
	[KLoading models @huggingface (6 in 0.348ms)
	[KLoading models @huggingface (6 in 0.379ms)
	[KLoading models @huggingface (6 in 0.41ms)
	[KLoading models @huggingface (6 in 0.441ms)
	[KLoading models @huggingface (6 in 0.472ms)
	[KLoading models @huggingface (6 in 0.503ms)
	[KLoading models @openrouter (284 in 0.534ms)
	[KLoading models @openrouter (284 in 0.564ms)
	[KLoading models @openrouter (284 in 0.596ms)
	[KLoading models @openrouter (284 in 0.626ms)
	[KLoading models @openrouter (284 in 0.657ms)
	[K[1A
	[K@ Loaded 637 inference models from 3 providers
	> cerebras
	> huggingface
	> openrouter
	```
- Duplicate unpack process, fix it
	```bash
	? Send prompt to LLiMo? (Y)es, No: 
	  read | 0:45 | $0.0422 | 168,990T |     3,699T/s
	reason | 0:00 | $0.0021 |   4,215T | 4,215,000T/s
	answer | 1:51 | $0.0079 |  15,825T |       141T/s
	  chat | 2:37 | $0.0523 | 189,030T |     1,199T/s | 1,810,970T
	+ reason (chat/b0416d7c-2e49-4408-9615-e32c41d08738/steps/001/reason.md)
	
	+ reason (chat/b0416d7c-2e49-4408-9615-e32c41d08738/steps/001/reason.md)
	+ answer (chat/b0416d7c-2e49-4408-9615-e32c41d08738/steps/001/answer.md)
	@ Extracting files (dry mode, no real saving)
	• releases/1/v1.0.0/005-UI-Progress/task.test.js (3,930 bytes) — Updated test for UI Progress
	• src/llm/Pricing.js (2,801 bytes) — Fixed Pricing.js
	• src/cli/Ui.js (11,892 bytes) — Fixed Ui.js
	• src/llm/Architecture.js (1,143 bytes) — Fixed Architecture.js
	• src/llm/AI.js (10,468 bytes) — Fixed AI.js
	• src/cli/ModelsOptions.js (3,786 bytes) — Fixed ModelsOptions.js
	• src/llm/providers/cerebras.info.js (5,279 bytes) — Fixed providers/cerebras.info.js
	Unpack current package? (Y)es, No, ., <message>: y
	@ Extracting files 
	+ releases/1/v1.0.0/005-UI-Progress/task.test.js (3,930 bytes) — Updated test for UI Progress
	+ src/llm/Pricing.js (2,801 bytes) — Fixed Pricing.js
	+ src/cli/Ui.js (11,892 bytes) — Fixed Ui.js
	+ src/llm/Architecture.js (1,143 bytes) — Fixed Architecture.js
	+ src/llm/AI.js (10,468 bytes) — Fixed AI.js
	+ src/cli/ModelsOptions.js (3,786 bytes) — Fixed ModelsOptions.js
	+ src/llm/providers/cerebras.info.js (5,279 bytes) — Fixed providers/cerebras.info.js
	@ Extracting files (dry mode, no real saving)
	• releases/1/v1.0.0/005-UI-Progress/task.test.js (3,930 bytes) — Updated test for UI Progress
	• src/llm/Pricing.js (2,801 bytes) — Fixed Pricing.js
	• src/cli/Ui.js (11,892 bytes) — Fixed Ui.js
	• src/llm/Architecture.js (1,143 bytes) — Fixed Architecture.js
	• src/llm/AI.js (10,468 bytes) — Fixed AI.js
	• src/cli/ModelsOptions.js (3,786 bytes) — Fixed ModelsOptions.js
	• src/llm/providers/cerebras.info.js (5,279 bytes) — Fixed providers/cerebras.info.js
	Unpack current package? (Y)es, No, ., <message>: %  
	```
- Only one of @ls entries is shown in the output, instead of three:
	```md
	#### [Cleanup & Archive](@bash)
	```bash
	mkdir -p archive/{fixes,backups,debug,logs/$(date +%Y%m%d)}
	mv app/fix_* archive/fixes/ 2>/dev/null || true
	mv app/backup_* archive/backups/ 2>/dev/null || true
	mv app/debug_* archive/debug/ 2>/dev/null || true
	rm -f app/*.deprecated 2>/dev/null || true
	mv app/logs/* archive/logs/$(date +%Y%m%d)/ 2>/dev/null || true
	echo "archive/
	logs/
	*.log
	__pycache__/
	.venv/" >> .gitignore
	```
	#### [Verify Cleanup](@ls)
	```
	archive/
	app/
	.gitignore
	```
	#### [4 file(s), 2 command(s)](@validate)
	```markdown
	- [Cleanup & Archive](@bash)
	- [Verify Cleanup](@ls)
	- [Updated .gitignore](.gitignore)
	```
	```
- List files for one file injects file instead of listing.
- Removing files before approval:
	```bash
	• app/script-init.js (530 bytes) — Extract Init
	▶ @rm
	 • Removing files:
	 + Removed: app/script.js
	```
