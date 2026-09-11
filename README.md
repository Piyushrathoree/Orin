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

### Run with Docker

The whole stack (UI, API, WebSocket server, plus a one-shot Prisma migrate step) also
runs as containers with one command:

```bash
bun run docker:up          # build + run; bun run docker:down to stop
```

It reuses the same env files as local dev (`apps/orin-backend/.env`, `apps/ws/.env`,
`packages/db/.env`) and the same host ports (3001 / 3030 / 8080). The database stays
on Neon. Containers run with `NODE_ENV=production`, so `AI_PROVIDER=local` is rejected —
leave it unset and add provider keys from the Settings page instead. `NEXT_PUBLIC_WS_URL`
is baked into the UI image at build time. If a port is taken, override the host side:
`UI_HOST_PORT=3101 API_HOST_PORT=3130 WS_HOST_PORT=8180 bun run docker:up`.

Projects and file trees are persisted through the backend, with browser storage
as a fallback cache. Peer collaboration uses the WebSocket/WebRTC service on
`ws://localhost:8080` locally.
