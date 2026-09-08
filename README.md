# Orin

Orin uses the existing `apps/ui` Next.js frontend and the standalone `apps/orin-backend` Express API.

For a guided, current-code walkthrough, read [`docs/README.md`](docs/README.md).
It includes the architecture, request flows, source map, interview questions,
and no-AI rewrite labs. `ORIN_REVIEW.md` and `audit.md` are historical notes
from an older implementation.

## Run locally

1. Copy `apps/orin-backend/.env.example` to `apps/orin-backend/.env` and choose `AI_PROVIDER=local` for Ollama/LM Studio/llama.cpp or `AI_PROVIDER=gemini` with a Gemini API key.
2. Set `ORIN_BACKEND_URL=http://localhost:3030` if needed.
3. Start all local services with one command:

```bash
bun run dev:all
```

The UI is available at `http://localhost:3001`, the AI backend at `http://localhost:3030`, and the collaboration WebSocket service uses port `8080`. Sign in, describe an app in the hero prompt, and Orin will generate it in the existing workspace.

Projects and file trees are persisted through the backend, with browser storage
as a fallback cache. Peer collaboration uses the WebSocket/WebRTC service on
`ws://localhost:8080` locally.
