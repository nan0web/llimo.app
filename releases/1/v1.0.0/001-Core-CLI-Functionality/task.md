# Core CLI functionality

Develop CLI application with the ability to run with the commands provided in the terminal `llimo chat /path/to/dir --test-dir /tmp/test`, `llimo chat --model=grok-code-fast`.

**Detailed requirements:**
- [ ] Implement argument parsing in bin/llimo-chat.js using src/cli/argvHelper.js to handle flags: --debug (verbose output), --new (create new chat), --yes (auto-confirm prompts), --test (test mode), --model=<id> (select model), --provider=<name> (AI provider, e.g. openai or huggingface/cerebras), and positional argv[0] as input file (me.md).
- [ ] Use parseArgv from argvHelper.js to instantiate ChatOptions class from src/Chat/Options.js, mapping flags to properties with defaults (e.g. isDebug=false, model="", etc.).
- [ ] Implement readInput function in src/llm/chatSteps.js: if stdin is not TTY read full stream, else read from file if argv[0] exists, else throw error "No input provided".
- [ ] Handle --test flag: set isTest=true, load from testDir if --test-dir provided, else error; use TestAI instead of real AI.
- [ ] Ensure CLI supports cd to working-dir if argv[0] is directory, and security validation with path.resolve to prevent pathway traversal (block ../ in inputs).
- [ ] Output usage/help on --help: show commands, options, and examples like "llimo chat me.md --model=gpt-oss-120b".

**Examples:**
- `llimo chat me.md`: Reads me.md (pre-prompt with checklists - [](src/**)), packs attachments into prompt, initializes chat.
- `cat prompt.md | llmo chat`: Reads full input from stdin, handles pipes.
- `llimo chat --test /tmp/test-chat`: Simulates using log files from /tmp/test-chat, no API calls.
- `llimo chat --debug me.md`: Verbose mode shows intermediate steps.

Create: bin/llimo-chat.js (CLI router, parse options, read input, simulate basic chat init without AI call).

Tests: bin/llimo-chat.test.js (spawn with args like --test, assert no crash, output matches expected; test --help), src/cli/argvHelper.test.js (parse flags/positionals), src/llm/chatSteps.test.js (readInput file/stdin cases, error on no input).

Deps: None (core CLI independent).

Security: Sanitize argv paths with path.resolve (prevent ../ escapes); limit input size in readInput (~10KB to prevent DoS); for --test use cwd isolation.

After code: Run tests from tests.txt, then pnpm test:all.

## Resources

- [argvHelper.js, Options.js from Chat](/src/cli/**)
- [main CLI entry, integrates parsing and input reading](/bin/llimo-chat.js)
- [readInput for stdin/file](/src/llm/chatSteps.js)

