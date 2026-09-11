# Build from the repository root:
#   docker build -f apps/ws/Dockerfile -t orin-ws .
FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/orin-backend/package.json apps/orin-backend/
COPY apps/ws/package.json apps/ws/
COPY apps/ui/package.json apps/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN bun install --frozen-lockfile

COPY packages/auth packages/auth
COPY apps/ws apps/ws

ENV NODE_ENV=production
# Cloud Run injects PORT; the app reads it.
ENV PORT=8080
EXPOSE 8080
WORKDIR /app/apps/ws
CMD ["bun", "run", "src/server.ts"]
