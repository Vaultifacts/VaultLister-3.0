# VaultLister Playwright Worker
# Separate Railway service — handles all browser automation (Poshmark, Mercari, etc.)

FROM mcr.microsoft.com/playwright:v1.58.2-noble AS base

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY worker/package.json ./worker/

# Install root deps (postgres.js, shared utils)
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Install worker deps
WORKDIR /app/worker
RUN bun install

WORKDIR /app

# Copy source
COPY src/ src/
COPY worker/ worker/

ENV NODE_ENV=production

CMD ["bun", "worker/index.js"]
