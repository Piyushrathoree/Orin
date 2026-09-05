# ⚡ Orin Backend - Website Generation API

## 🌟 Overview

The **Orin Backend** transforms natural-language prompts into complete website
code using Gemini, OpenRouter, or a local OpenAI-compatible model.

## 💻 Tech Stack

- Express.js
- Google Gemini API
- Ollama, LM Studio, or another local OpenAI-compatible server
- Node.js

## 📥 Installation

1. **Install dependencies**
    ```bash
    bun install
    ```

2. **Choose a provider in `.env`**

    Local Ollama is the default:

    ```env
    AI_PROVIDER=local
    LOCAL_BASE_URL=http://127.0.0.1:11434/v1
    LOCAL_API_KEY=ollama
    LOCAL_MODEL=qwen3:8b
    ```

    For Gemini:

    ```env
    AI_PROVIDER=gemini
    GEMINI_API_KEY=your-gemini-api-key
    GEMINI_MODEL=gemini-2.5-flash
    ```

    For OpenRouter:

    ```env
    AI_PROVIDER=openrouter
    OPENROUTER_API_KEY=your-openrouter-api-key
    OPENROUTER_MODEL=your-provider/model-name
    ```

    For local models, `LOCAL_BASE_URL` can point to LM Studio or llama.cpp if
    they expose an OpenAI-compatible `/v1/chat/completions` endpoint.

3. **Run the server**
    ```bash
    bun run dev
    ```

The API exposes `GET /health`, `POST /template`, and `POST /chat`.
