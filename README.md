# Orin

Orin uses the existing `apps/ui` Next.js frontend and the standalone `apps/orin-backend` Express/Groq API.

## Run locally

1. Copy `apps/orin-backend/.env.example` to `apps/orin-backend/.env` and set `GROQ_API_KEY`.
2. Keep Clerk credentials in `apps/ui/.env.local` and set `ORIN_BACKEND_URL=http://localhost:3030` if needed.
3. Start the two services:

```bash
bun run dev:orin-backend
bun run dev:orin
```

The landing page is available at `http://localhost:3001`. Sign in, describe an app in the hero prompt, and Orin will generate it in the existing workspace.

The UI stores project lists and file trees in browser storage; it does not require Convex or Inngest. Peer collaboration still expects the existing WebSocket/WebRTC service on `ws://localhost:8080`.
