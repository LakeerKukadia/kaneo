# Multi-stage Docker build for Kaneo API
# This Dockerfile should be run from the repository root

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ && \
    corepack enable && \
    corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for better Docker layer caching
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build the API
WORKDIR /app/apps/api
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    apk add --no-cache wget

WORKDIR /app

# Copy built application and database migrations first
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle

# Only copy the API package.json for runtime dependencies
COPY apps/api/package.json ./apps/api/

# Install only production runtime dependencies for the API
WORKDIR /app/apps/api
RUN corepack enable && \
    corepack prepare pnpm@10.15.0 --activate && \
    HUSKY=0 pnpm install --prod --frozen-lockfile --ignore-scripts

# Set ownership and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]