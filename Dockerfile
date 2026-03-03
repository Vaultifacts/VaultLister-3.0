# VaultLister Dockerfile
# Multi-stage build for production deployment

# ============================================
# Stage 1: Builder
# ============================================
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install all dependencies (devDeps needed for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN bun run build

# Prune to production dependencies
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# ============================================
# Stage 2: Production
# ============================================
FROM oven/bun:1.3-slim AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vaultlister

# Copy built application
COPY --from=builder --chown=vaultlister:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vaultlister:nodejs /app/src ./src
COPY --from=builder --chown=vaultlister:nodejs /app/public ./public
COPY --from=builder --chown=vaultlister:nodejs /app/dist ./dist
COPY --from=builder --chown=vaultlister:nodejs /app/scripts/build-frontend.js ./scripts/build-frontend.js
COPY --from=builder --chown=vaultlister:nodejs /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data /app/logs /app/backups && \
    chown -R vaultlister:nodejs /app/data /app/logs /app/backups

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV LOG_DIR=/app/logs
ENV TRUST_PROXY=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/api/health',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Switch to non-root user
USER vaultlister

# Expose port
EXPOSE 3000

# Start application
CMD ["bun", "run", "src/backend/server.js"]
