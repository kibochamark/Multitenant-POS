# -----------------------------
# Base
# -----------------------------
FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable


# -----------------------------
# Dependencies
# -----------------------------
FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile


# -----------------------------
# Database schema runner
# -----------------------------
FROM dependencies AS migration

COPY prisma ./prisma
COPY prisma.config.ts ./

CMD ["pnpm", "prisma", "db", "push"]


# -----------------------------
# Build
# -----------------------------
FROM dependencies AS build

COPY . .

RUN pnpm prisma generate
RUN pnpm run build


# -----------------------------
# Production dependencies
# -----------------------------
FROM dependencies AS production-dependencies

RUN pnpm prune --prod


# -----------------------------
# Production
# -----------------------------
FROM base AS production

ENV NODE_ENV=production

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node

EXPOSE 5000

CMD ["node", "dist/src/main.js"]





