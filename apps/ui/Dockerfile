# Build from the repository root:
#   docker build -f apps/ui/Dockerfile --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:8080 -t orin-ui .
FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/orin-backend/package.json apps/orin-backend/
COPY apps/ws/package.json apps/ws/
COPY apps/ui/package.json apps/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile

COPY packages/auth packages/auth
COPY apps/ui apps/ui

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# Leave NEXT_PUBLIC_WS_URL empty to disable real-time collaboration.
ARG NEXT_PUBLIC_WS_URL=
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN bun run --cwd apps/ui build

ENV NODE_ENV=production
# `next start` reads PORT; without it Next defaults to 3000.
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/apps/ui
CMD ["bun", "run", "start"]
