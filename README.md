# LLiMo Chat Control Toolkit

LLiMo is a tool that helps generate code in a test-first development approach, using LLM models like OpenAI, Cerebras, etc. This toolkit focuses on file-based chat testing and simulation for debugging and automation without relying on external AI APIs.

## Installation and Setup

```bash
pnpm install
```

Set environment variables for models:
```bash
export LLIMO_MODEL=<model-name>  # e.g., gpt-oss-120b
export OPENAI_API_KEY=<your-key>  # For OpenAI provider
export CEREBRAS_API_KEY=<your-key>  # For Cerebras provider
# etc. for other providers
```

## Usage

### 1. Model Selection and Chat Initialization

Run `llimo-chat` to start a new chat or resume an existing one:

```bash
# Start a new chat with specific model and provider
llimo-chat --new --model gpt-oss-120b --provider openai my-prompt.md

# Or use environment variable for default model
LLIMO_MODEL=gpt-oss-120b llimo-chat --new --debug my-prompt.md

# Resume existing chat from 'chat/current' (auto-detected)
llimo-chat my-prompt.md

# Use stdin as input
echo "Your prompt here" | llimo-chat --debug
```

The tool will:
- Load available models from configured providers.
- Select the specified model or prompt for choice if ambiguous.
- Pack the prompt with system.md and any referenced files.
- Stream the AI response, unpack it, run tests, and commit if successful.

Flags:
- `--new`: Force new chat directory.
- `--yes`: Auto-confirm unpack and test steps.
- `--test-dir=<dir>`: Use test mode with files from <dir> (for debugging).
- `--debug`: Enable debug logging.

Output includes pricing info (e.g., prompt: $0.41, completion: $0.08) and progress bars for reading/reasoning/answering phases.

### 2. Testing Scenarios with Logs (File-Based Simulation)

LLiMo supports testing chat interactions using pre-recorded log files from chat directories. This is useful for:
- Reproducing user-reported bugs or errors.
- Testing error handling (e.g., partial responses, server failures).
- Debugging unpack and test processes without API calls.
- Automating CI/CD for chat-based workflows.

Supported log files in chat directory (e.g., `chat/b651551f-8212-405a-a787-5634706f87a2/`):
- `answer.md`: Full AI response.
- `chunks.json`: Array of stream chunks (e.g., [{"type": "text-delta", "text": "Hello"}] for simulation).
- `messages.jsonl`: JSONL of chat messages to override default history.
- `reason.md`: Reasoning content.
- `response.json`: Usage stats and metadata.
- `stream.json`: Alternative to chunks.json for stream events.
- `stream.md`: Extra stream text appended to response.
- `tests.txt`: Logged to console with `--debug` (expected test outputs).
- `todo.md`: Logged to console with `--debug` (remaining tasks).
- `unknown.json`: Logged to console with `--debug` (unhandled data).

#### Running Tests from Logs

Use `llimo-chat-test` for info and simulation:

```bash
# Show chat info and step tokens
llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2/ info

# Simulate unpack from step 3, output to /tmp/unpack
llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2/ --step 3 unpack --dir /tmp/unpack

# Simulate full testing from step 1
llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2/ --step 1 test
```

For dynamic simulation:

```bash
# Use test mode in llimo-chat to simulate one-step chat loop
llimo-chat --test-dir=chat/b651551f-8212-405a-a787-5634706f87a2/

# Create custom test scenario
mkdir test-bug-repro
cd test-bug-repro
# Create files like above (e.g., chunks.json with error)
# Run simulation
cd -
llimo-chat --test-dir=test-bug-repro --yes --debug
```

Test mode uses `TestAI` which reads files to emulate responses. Progress bars reflect simulated usage/tokens.

#### Example: Reproducing a User Bug

1. User sends zipped chat directory (`bug-report.zip`).
2. Unpack and run:
   ```bash
   unzip bug-report.zip -d repro-chat
   llimo-chat --test-dir=repro-chat --yes --debug
   ```
3. Analyze logs for errors, unpack results, or test failures.

#### Common Test Mode Errors
- **No messages.jsonl or loading fails**: Ensure file exists and parse correctly (check with Chat.test.js).
- **Messages.jsonl shows 0 but has entries**: JSONL parsing error; check for malformed JSON.
- **Step exceeds history**: Number of user msgs < step; use `info` to verify.
- **NaN speeds/costs**: Fixed in `formatChatProgress` with safe normalization.

### 3. Packing Files into Prompts

Use `llimo-pack` to bundle files into a Markdown prompt:

```bash
# From checklist in stdin
echo "- [](src/index.js)\n- [](README.md)" | llimo-pack

# From file with patterns
llimo-pack input.md output.md

# List files without code
echo "- [-**/*.test.js](src/**)" | llimo-pack
```

Globs (`src/**/*.js`) are supported with negative patterns (`-**/test.js`).

### 4. Unpacking AI Responses to Files

Use `llimo-unpack` to extract files from Markdown responses:

```bash
# From stdin
echo '#### [file.js](file.js)\n```js\ncode\n```' | llimo-unpack

# From file, output prefix
llimo-unpack response.md --dry  # Simulate without saving
llimo-unpack response.md extracted/

# Pipe from another command
llimo-pack prompt.md | llimo-chat --new | llimo-unpack results/
```

Supports code blocks (`\`\`\`js`), commands (`@bash`, etc.), and nested files.

### 5. Getting Models Info

```bash
llimo-models  # List all @provider models
# Output: @openai: openai, etc.
```

### 6. Generating System Prompts

```bash
llimo-system > system.md  # Output to stdout
llimo-system system.md    # Save to file
```

Includes command documentation and tool list.

## API Reference

### Core Classes

- `Chat`: Manages conversation history, saves to `chat/<id>/messages.jsonl`.
- `AI`: Loads models, streams text from providers (OpenAI, Cerebras, HuggingFace, OpenRouter).
- `TestAI`: Simulates AI using log files for testing.
- `ModelProvider`: Caches and fetches model metadata (TTL 1h).

### Functions (src/)

- `loadModels()`: Fetch and cache models from providers.
- `selectModel()`: Interactive model selection based on partial ids.
- `packMarkdown()`: Bundle files/patterns into prompt Markdown.
- `unpackAnswer()`: Extract files/commands from response Markdown.
- `formatChatProgress()`: Generate progress display with speeds/costs (fixed NaN handling).
- `startStreaming()`: Handle AI streaming with chunks.

Commands: `@bash`, `@get`, `@ls`, `@rm`, `@summary`, `@validate` (use in responses for tooling).

## Testing

Run all tests (node:test format):

```bash
pnpm test:all  # Covers all src/** exports and edge cases
```

Add test scenarios in `src/llm/TestAI.test.js` with temp dirs/files.

## Troubleshooting

- **Pricing always 0?** Check model.pricing in response.json for simulation.
- **Messages not loading?** Use Chat.test.js to verify messages.jsonl parsing (5 messages in chat dir).
- **NaN speeds?** Fixed with `safeSpent`/`safeSpeed` in formatChatProgress.
- **API key missing?** Set environment variables for provider (e.g., CEREBRAS_API_KEY).
- **Unpack errors?** Use `--dry` to preview. Check response Markdown format.
- **Model not found?** `llimo-models` to list; partial matches supported.

For issues, include zipped chat directory for reproduction.

## Recent Fixes

- Fixed `formatChatProgress` to handle large elapsed by recalculating if >3600 seconds.
- Fixed Chat.test.js to save/load messages.jsonl properly via chat.db.save().
- Fixed validation counts in ValidateCommand.test.md.
- Fixed bin/llimo-chat-test.js to parse positional mode argument correctly.

## Contributing

- JSDoc all exported functions/methods in English.
- Add tests for new features (100% coverage).
- Files under src/** are auto-typed; use @typedef for complex types.
- Use `node:test describe > it` format.
- Follow @todo comments in code.

For system improvements, add tests to expose errors before fixing (e.g., NaN in progress), teach the system to handle edge cases gracefully (default values, safe arithmetic).
