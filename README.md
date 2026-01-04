# LLiMo - LLM Interface for Model Operations

A powerful CLI tool for interacting with multiple AI model providers including Cerebras, HuggingFace, OpenAI, and OpenRouter.

## Quick Start

### 1. Set up your API key

Choose one of the supported providers and set the corresponding environment variable:

```bash
# Cerebras (recommended for fast inference)
export CEREBRAS_API_KEY=your_cerebras_key_here

# HuggingFace
export HUGGINGFACE_API_KEY=your_hf_key_here
# or
export HF_TOKEN=your_hf_token_here

# OpenAI
export OPENAI_API_KEY=your_openai_key_here

# OpenRouter
export OPENROUTER_API_KEY=your_openrouter_key_here
```

### 2. Initialize and start chatting

Use the convenient `initKey` script to set up your environment and start chatting:

```bash
npm run initKey
```

This will:
- Load your environment variables from `.env` file (if present)
- Start a fast chat session with the best available model
- Automatically select an optimal model based on your API keys

### 3. Alternative usage

```bash
# Fast chat with automatic model selection
node bin/llimo chat --fast

# Browse available models
node bin/llimo models

# Chat with a specific model
node bin/llimo chat --model qwen-3-235b

# Chat with file input
node bin/llimo chat input.md

# Interactive chat
node bin/llimo chat
```

## Model Browsing

```bash
node bin/llimo models
```

Features:
- Interactive model browser when run in TTY
- Pipe-friendly table output for scripts
- Search and filter capabilities
- Shows pricing, context length, and capabilities

## Getting API Keys

### Cerebras (Recommended)
1. Visit [Cerebras Inference](https://inference-docs.cerebras.ai/)
2. Sign up and get your API key
3. Fast inference with competitive pricing

### HuggingFace
1. Visit [HuggingFace](https://huggingface.co/settings/tokens)
2. Create a new token with appropriate permissions
3. Access to many open-source models

### OpenAI
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Access to GPT models

### OpenRouter
1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Create an API key
3. Access to multiple model providers through one API

## Environment Setup

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Then edit `.env` with your actual API keys. See `.env.example` for all available environment variables.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run all tests including build
npm run test:all

# Build TypeScript definitions
npm run build
```
