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
# Build
# -----------------------------
FROM dependencies AS build

COPY . .

RUN pnpm run build


# -----------------------------
# Production
# -----------------------------
FROM base AS production

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]






