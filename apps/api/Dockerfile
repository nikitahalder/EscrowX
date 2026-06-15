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

# Copy hoisted node_modules (workspace deps are installed here)
COPY --from=builder --chown=nestjs:nodejs /repo/node_modules ./node_modules
# Copy built output, Prisma schema, and package manifest
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/package.json ./

USER nestjs
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
# Run Prisma migrations on startup, then start the API
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node dist/main"]
