# VaultLister Dockerfile
# Multi-stage build for production deployment
# Builder → Runtime (optimized for minimal size and startup time)

# ============================================
# Stage 1: Builder
# ============================================
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy package files (use bun.lockb if available)
COPY package.json bun.lock* bun.lockb* ./

# Install all dependencies (devDeps needed for build)
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN bun run build

# Prune to production dependencies only (excludes devDependencies)
RUN rm -rf node_modules && \
    bun install --production --frozen-lockfile

# ============================================
# Stage 2: Production
# ============================================
FROM oven/bun:1.3-slim AS production

WORKDIR /app

# Create non-root user for security (Debian-based image)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home --shell /sbin/nologin vaultlister

# Install system dependencies in a single RUN to reduce layers
# libvips for sharp image processing, postgresql-client for health checks and DB operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg \
    libvips42 \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Add PostgreSQL GPG key (optional, for verification)
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg || true

# Create data, logs, and backups directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/backups && \
    chown -R vaultlister:nodejs /app /tmp && \
    chmod -R 755 /app

# Copy built application from builder stage
COPY --from=builder --chown=vaultlister:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vaultlister:nodejs /app/src ./src
COPY --from=builder --chown=vaultlister:nodejs /app/public ./public
COPY --from=builder --chown=vaultlister:nodejs /app/dist ./dist
COPY --from=builder --chown=vaultlister:nodejs /app/scripts ./scripts
COPY --from=builder --chown=vaultlister:nodejs /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    LOG_DIR=/app/logs \
    TRUST_PROXY=1 \
    BUN_RUNTIME_SYMLINKS_ENABLED=1

# Health check: verify API is responsive
HEALTHCHECK --interval=30s --timeout=60s --start-period=30s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/api/health',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1

# Switch to non-root user
USER vaultlister

# Expose port
EXPOSE 3000

# Start application
CMD ["bun", "run", "--inspect=0.0.0.0:9229", "src/backend/server.js"]
