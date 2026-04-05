
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first
COPY package.json package-lock.json ./

# Install ALL deps
RUN npm ci --frozen-lockfile

# Stage Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

# Stage Production runner
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 fintrack

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN chown -R fintrack:nodejs /app

USER fintrack

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "dist/server.js"]