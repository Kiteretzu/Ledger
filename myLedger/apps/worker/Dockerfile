# 1. Base image
FROM node:20 AS base

# 2. Builder: Prune with Turbo
FROM base AS builder
WORKDIR /app
RUN npm install -g turbo pnpm
COPY . .
RUN turbo prune worker --docker

# 3. Installer: Install deps and build
FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm turbo      

# Copy pruned lockfile + package.json
COPY --from=builder /app/out/json/ .

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile


# Copy full pruned source
COPY --from=builder /app/out/full/ .
# Build with turbo
RUN turbo build


# 4. Runner: Run the app
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

# Create app directory
WORKDIR /app



COPY --from=installer /app .

CMD ["node", "apps/worker/dist/index.js"]