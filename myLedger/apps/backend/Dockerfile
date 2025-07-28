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

# Install Chromium
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  wqy-zenhei \
  udev \
  libstdc++

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Create user
RUN addgroup --system --gid 1001 backend \
    && adduser --system --uid 1001 backend

# Create captcha folder and fix permissions
RUN mkdir -p /app/apps/backend/src/captcha \
    && chown -R backend:backend /app/apps/backend/src/captcha

COPY --from=installer /app .

# Fix permissions again after copy
RUN mkdir -p /app/apps/backend/src/captcha \
    && chown -R backend:backend /app/apps/backend/src/captcha

USER backend

CMD ["node", "apps/backend/dist/index.js"]