# 1. Base image
FROM node:20-alpine AS base

# 2. Builder: Prune with Turbo
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo pnpm
COPY . .
RUN turbo prune backend --docker

# 3. Installer: Install deps and build
FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm        
RUN npm install -g turbo
WORKDIR /app

# Copy pruned lockfile + package.json
COPY --from=builder /app/out/json/ .

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile


# Copy full pruned source
COPY --from=builder /app/out/full/ .
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
# Build with turbo
RUN turbo build
# 4. Runner: Run the app
FROM base AS runner
WORKDIR /app

# Install Chromium for Puppeteer
RUN apk add --no-cache chromium

# Let Puppeteer know where Chromium is installed
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 backend
RUN adduser --system --uid 1001 backend
USER backend
COPY --from=installer /app .

CMD ["node", "apps/backend/dist/index.js"]