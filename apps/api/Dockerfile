# syntax=docker/dockerfile:1
# Build from repo root: docker build -f apps/api/Dockerfile .

# ── Prune monorepo to only what the API needs ─────────────────────────────────
FROM node:20-alpine AS pruner
WORKDIR /repo
RUN npm install -g turbo
COPY . .
RUN turbo prune @escrowx/api --docker

# ── Install dependencies (pruned manifest only) ───────────────────────────────
FROM node:20-alpine AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/package-lock.json ./package-lock.json
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM installer AS builder
COPY --from=pruner /repo/out/full/ .
RUN cd apps/api && npx prisma generate
RUN npx turbo run build --filter=@escrowx/api

# ── Production runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4000

RUN apk add --no-cache dumb-init

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Preserve the monorepo layout so Node resolves both the root-hoisted modules
# and the workspace-local modules in apps/api/node_modules (where @nestjs/* live).
COPY --from=builder --chown=nestjs:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api ./apps/api

WORKDIR /app/apps/api
USER nestjs
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
# Sync the Prisma schema, then start the API. prisma resolves from apps/api/node_modules.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss && node dist/main"]
