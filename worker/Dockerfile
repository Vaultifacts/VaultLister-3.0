# VaultLister Playwright Worker
# Separate Railway service — handles all browser automation (Poshmark, Mercari, etc.)

FROM mcr.microsoft.com/playwright:v1.59.1-noble AS base

# Install Bun
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.9" && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod 755 /usr/local/bin/bun
ENV PATH="/usr/local/bin:/root/.bun/bin:$PATH"

# GTK3 and X11 libs required for Camoufox (headless Firefox)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2t64 xvfb libdbus-1-3 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN groupadd -r vaultlister && useradd -r -g vaultlister -d /app vaultlister

# Copy package files
COPY package.json bun.lock* bun.lockb* ./
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

# Camoufox (Firefox) requires adequate shared memory — Railway reads this env var
ENV RAILWAY_SHM_SIZE_BYTES=2147483648

# Verify the BullMQ worker process is alive by checking its PID file or process list
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD pgrep -f "bun worker/index.js" > /dev/null || exit 1

USER vaultlister
CMD ["bun", "worker/index.js"]
