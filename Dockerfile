# CinemaHint Server - Single Stage Build (Space Optimized)
FROM node:18-alpine

# Install system dependencies and create user in one layer
RUN apk add --no-cache tini curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S cinemahint -u 1001

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies directly (no intermediate stage to avoid large COPY)
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm /tmp/* \
    && chown -R cinemahint:nodejs /app

# Copy source code
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