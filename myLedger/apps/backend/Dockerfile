# 1. Base image (Debian-based)
FROM node:20 AS base

# Skip Puppeteer’s Chromium download (we’ll install Chrome manually)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 2. Builder: Prune with Turbo
FROM base AS builder
WORKDIR /app
RUN npm install -g turbo pnpm
COPY . .
RUN turbo prune backend --docker

# 3. Installer: Install deps, Puppeteer & build
FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm turbo

# Copy pruned package.json + lockfile
COPY --from=builder /app/out/json/ .

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Install Puppeteer explicitly (so we can run its CLI)
RUN pnpm add puppeteer --workspace-root --prod

# Copy pruned full source
COPY --from=builder /app/out/full/ .

# Install Chrome for Puppeteer
RUN npx puppeteer browsers install chrome

# Generate Prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build with Turbo
RUN turbo build

# 4. Runner: Final image
FROM node:20-slim
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy build output, node_modules, and Puppeteer cache from installer stage
COPY --from=installer /app .
COPY --from=installer /root/.cache/puppeteer /root/.cache/puppeteer

# Set Puppeteer executable path
ENV PUPPETEER_EXECUTABLE_PATH="/root/.cache/puppeteer/chrome/linux-139.0.7258.66/chrome-linux64/chrome"

CMD ["node", "apps/backend/dist/index.js"]