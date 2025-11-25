When I run the test `llimo-pack.test.js` I got all the project files (.) deleted.

I cannot pack with patterns (micromatch) still.

But this is fixed in the `llimo-unpack.test.js`.

All tests in `src/**` passed.

1. Cover bin/llimo-system.test.js with tests.
1. Fix the error with deleting the project.
1. Add bin/llimo-chat.js with next features:
	1. Getting input data from stdin, readline or first argument that is not an option
	1. Handling 3 API throught `ai`, `@ai-sdk/cerebras`, `@ai-sdk/huggingface`, `@openrouter/ai-sdk-provider`:
		- `streamText` or chat text without streaming with current chat (`chat/<id>/messages.jsonl`);
		- `getModels()` get the models from the SDK or API, and if not available provide harcoded;
		- calculating chat input, output, summary cost for every chat iteration;
		- store usage information and cost in `messages.jsonl`;
	1. Show chat progress:
		- 30fps, update on data received or/and timer, but frequency is 30 (or another if defined)
		- if cache price is available for the current model use it in calculations and progress (+1 line)
		- if thinking is available for the current model show it in the progress (+1 line)
		- input `chat progress → …` is required
		- save the output into `prompt.md` in the current chat, in the example redirect with commetn `# > chat/{ID}/prompt.md`
	1. Continue chatting until any of the conditions met:
		- all tests passed, including pnpm build:
			- run all tests `pnpm test:all` that includes `test`, `pnpm build`
		- 3 recent answers had produced error more or the same as previous (LLiMo stuck and unable to solve the puzzle)
	1. Create a git branch `2511/llimo-chat` before starting a task, this way it would be eaiser to trace failed branches and work with different tasks in different branches:
		- after every response and processing answer `git commit -a -m …`
		- when complete move branch to `2511-done/llimo-chat` and push a branch to the remote
		- when fail move branch to `2511-fail/llimo-chat`

	Example of the usage:
		```bash
		% CEREBRAS_API_KEY="csk..." node bin/llimo-chat.js me.md
		>
		> no chat history found, creating new chat ({ID})
		>
		> preparing me.md (/Users/i/src/purejs/llimo.app/me.md)
		> + me.md (/Users/i/src/purejs/llimo.app/chat/{ID}/me.md)
		>   copied to chat session
		> node bin/llimo-pack.js chat/{ID}/me.md chat/{ID}/prompt.md
		> + prompt.md (/Users/i/src/purejs/llimo.app/chat/{ID}/prompt.md)
		>   injected 2 file(s):
		> - [](bin/llimo-pack.js)
		> - [](bin/llimo-pack.test.js)
		>   Prompt size: 70,515 bytes — 2 file(s).
		>
		> step 1. 2025-11-25T01:28:54 (00:00:01.350)
		>
		> sending prompt to API (streaming)
		> model [gpt-oss-120b](@cerebras) → $0.20/MT ← $0.80/MT (cache - $0.10/MT)
		>
		> ! batch processing has 50% discount comparing to streaming
		>
		>                 tokens  | speed    | time   | cost
		> chat progress → 17,100T | 3,240T/s | 4.668s | $0.003
		>      thinking ←  1,350T |   420T/s | 3.214s | $0.001
		>      writing  ←    999T |    99T/s | 10.00s | $0.001
		>      total      18,099T |   997T/s | 18.15s | $0.005
		>
		> + think.md (/Users/i/src/purejs/llimo.app/chat/{ID}/think.md)
		>   Think size: 5,400 bytes (1,350T)
		> + answer.md (/Users/i/src/purejs/llimo.app/chat/{ID}/answer.md)
		>   Answer size: 4,320 bytes (999T)
		>
		> decoding answer
		> echo '```bash' # > chat/{ID}/prompt.md
		> node bin/llimo-unpack.js chat/{ID}/answer.md # >> chat/{ID}/prompt.md 2>&1
		> Extracting files
		>  • src/test-utils.js (3,029 bytes)
		>  ! Unexpected response "Validate the fix"
		>    but provided: 1 file(s), 0 command(s)
		>  ℹ label format for @validate is:
		>    #### [N file(s), M command(s)](@validate)
		>    > N - amount of file(s) minus command(s)
		>    > M - amount of commands(s) minus validate command (-1)
		>    > if amount is zero part with its number might be skipped
		>  + Expected validation of files 100% valid
		>  • Empty rows #90
		> echo '```' # >> chat/{ID}/prompt.md
		>
		> running tests
		> pnpm test # >> chat/{ID}/prompt.md
		> ℹ tests 6
		> ℹ suites 1
		> ℹ pass 1
		> ℹ fail 5
		> ℹ cancelled 0
		> ℹ skipped 0
		> ℹ todo 0
		> ℹ duration_ms 174.240666
		>
		> ✖ failing tests:
		> 
		> test at bin/llimo-pack.test.js:61:2
		> ✖ should pack multiple files from stdin markdown (37.024083ms)
		> 	AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
		> 	
		> 	1 !== 0
		> 	
		> 			at TestContext.<anonymous> (file:///Users/i/src/purejs/llimo.app/bin/llimo-pack.test.js:71:10)
		> 			at async Test.run (node:internal/test_runner/test:1054:7)
		> 			at async Suite.processPendingSubtests (node:internal/test_runner/test:744:7) {
		> 		generatedMessage: true,
		> 		code: 'ERR_ASSERTION',
		> 		actual: 1,
		> 		expected: 0,
		> 		operator: 'strictEqual',
		> 		diff: 'simple'
		> 	}
		>
		> step 2. 2025-11-25T01:29:00 (00:00:39.420)
		>
		> sending prompt to API (streaming)
		> model [gpt-oss-120b](@cerebras) → $0.20/MT ← $0.80/MT (cache - $0.10/MT)
		>
		> ! batch processing has 50% discount comparing to streaming
		>
		>                 tokens  | speed    | time   | cost
		> chat progress → 21,300T | 3,240T/s |  6.78s | $0.003
		>      thinking ←  1,350T |   420T/s | 3.214s | $0.001
		>      writing  ←    999T |    99T/s | 10.00s | $0.001
		>      total      23,649T |   997T/s | 23.72s | $0.005
		>
		> + think.md (/Users/i/src/purejs/llimo.app/chat/{ID}/think.md)
		>   Think size: 5,400 bytes (1,350T)
		> + answer.md (/Users/i/src/purejs/llimo.app/chat/{ID}/answer.md)
		>   Answer size: 4,320 bytes (999T)
		>
		> decoding answer
		> echo '```bash' # > chat/{ID}/prompt.md
		> node bin/llimo-unpack.js chat/{ID}/answer.md # >> chat/{ID}/prompt.md 2>&1
		> Extracting files
		>  • src/test-utils.js (3,029 bytes)
		>  ! Unexpected response "Validate the fix"
		>    but provided: 1 file(s), 0 command(s)
		>  ℹ label format for @validate is:
		>    #### [N file(s), M command(s)](@validate)
		>    > N - amount of file(s) minus command(s)
		>    > M - amount of commands(s) minus validate command (-1)
		>    > if amount is zero part with its number might be skipped
		>  + Expected validation of files 100% valid
		>  • Empty rows #90
		> echo '```' # >> chat/{ID}/prompt.md
		>
		> running tests
		> pnpm test:all # >> chat/{ID}/prompt.md 2>&1
		> ℹ tests 6
		> ℹ suites 1
		> ℹ pass 6
		> ℹ fail 0
		> ℹ cancelled 0
		> ℹ skipped 0
		> ℹ todo 0
		> ℹ duration_ms 174.240666
		>
		> pnpm build # >>  chat/{ID}/.md 2>&1
		> 
		> All tests passed, no typed mistakes.
		```

- [](bin/llimo-pack.js)
- [](bin/llimo-pack.test.js)
- [](bin/llimo-system.js)
- [](bin/llimo-unpack.js)
- [](bin/llimo-unpack.test.js)
- [](src/FileProtocol.js)
- [](src/llm/commands/BashCommand.js)
- [](src/llm/commands/BashCommand.test.js)
- [](src/llm/commands/Command.js)
- [](src/llm/commands/GetFilesCommand.js)
- [](src/llm/commands/GetFilesCommand.test.js)
- [](src/llm/commands/index.js)
- [](src/llm/commands/ListFilesCommand.js)
- [](src/llm/commands/ListFilesCommand.test.js)
- [](src/llm/commands/RemoveCommand.js)
- [](src/llm/commands/RemoveCommand.test.js)
- [](src/llm/commands/SummaryCommand.js)
- [](src/llm/commands/SummaryCommand.test.js)
- [](src/llm/commands/ValidateCommand.js)
- [](src/llm/commands/ValidateCommand.test.js)
- [](src/utils/FileSystem.js)
- [](src/utils/Markdown.js)
- [](src/utils/Path.js)
- [](src/utils/Readline.js)
- [](package.json)

---

Secure the removing test dirs

`await rm(dir, { recursive: true, force: true })`

I have lost project files already many times recently, tests are removing cwd and its content.
