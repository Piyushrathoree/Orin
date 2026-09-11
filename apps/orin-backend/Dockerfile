# Build from the repository root:
#   docker build -f apps/orin-backend/Dockerfile -t orin-api .
# Bun runs the TypeScript sources directly; the workspace packages export raw .ts.
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
COPY packages/db packages/db
COPY apps/orin-backend apps/orin-backend

# prisma generate does not connect to the database; the placeholder only
# satisfies the config loader.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" bun run db:generate

ENV NODE_ENV=production
# Cloud Run injects PORT; the app reads it.
ENV PORT=8080
EXPOSE 8080
WORKDIR /app/apps/orin-backend
CMD ["bun", "run", "src/index.ts"]
