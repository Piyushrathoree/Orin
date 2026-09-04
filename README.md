# Orin

Orin uses the existing `apps/ui` Next.js frontend and the standalone `apps/orin-backend` Express API.

## Run locally

1. Copy `apps/orin-backend/.env.example` to `apps/orin-backend/.env` and choose `AI_PROVIDER=local` for Ollama/LM Studio/llama.cpp or `AI_PROVIDER=gemini` with a Gemini API key.
2. Set `ORIN_BACKEND_URL=http://localhost:3030` if needed. Custom JWT auth will be added later.
3. Start all local services with one command:

```bash
bun run dev:all
```

The UI is available at `http://localhost:3001`, the AI backend at `http://localhost:3030`, and the collaboration WebSocket service uses port `8080`. Sign in, describe an app in the hero prompt, and Orin will generate it in the existing workspace.

The UI stores project lists and file trees in browser storage;. Peer collaboration still expects the existing WebSocket/WebRTC service on `ws://localhost:8080`.
