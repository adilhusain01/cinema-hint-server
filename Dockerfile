# CinemaHint Server-Only Docker Build
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    tini \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S cinemahint -u 1001

# Set working directory
WORKDIR /app

# =============================================
# DEPENDENCIES STAGE
# =============================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies with optimized flags
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm

# =============================================
# PRODUCTION STAGE
# =============================================
FROM base AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy production dependencies
COPY --from=dependencies --chown=cinemahint:nodejs /app/node_modules ./node_modules

# Copy server source code
COPY --chown=cinemahint:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown cinemahint:nodejs logs

# Switch to non-root user
USER cinemahint

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "server.js"]