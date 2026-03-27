# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY tg-bot/package*.json ./
COPY tg-bot/tsconfig.json ./

RUN npm ci

COPY tg-bot/src/ ./src/

RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

COPY tg-bot/package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

COPY --from=builder --chown=botuser:nodejs /app/dist ./dist

USER botuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
