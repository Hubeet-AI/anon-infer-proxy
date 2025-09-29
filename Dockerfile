# Multi-stage build for anon-infer-proxy
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Change ownership to appuser
RUN chown -R appuser:nodejs /app
USER appuser

# Expose port for development server
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder

# Install all dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build && \
    npm prune --production

# Production stage
FROM base AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy any additional files needed
COPY --from=builder /app/README.md ./
COPY --from=builder /app/LICENSE ./

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('./dist/index.js').healthCheck().then(h => h.healthy ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Expose port (if running as a service)
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/index.js"]

# Test stage
FROM builder AS test

# Set test environment
ENV NODE_ENV=test

# Copy test files
COPY src/__tests__ ./src/__tests__

# Run tests
RUN npm test

# Lint stage
FROM builder AS lint

# Run linting
RUN npm run lint
