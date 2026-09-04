Orin is the active Next.js frontend. The marketing landing page, dashboard, collaborative editor, and WebContainers all run from this package. Custom JWT auth will be added later. AI requests are proxied to `apps/orin-backend`.

## Getting Started

Run the development server from the repository root:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the Orin app.

The active landing page is `src/app/page.tsx`; the dashboard and editor remain under the same app so the existing UI stays connected to the Orin backend and WebContainers.

Set `ORIN_BACKEND_URL` when the backend is not running at `http://localhost:3030`.
