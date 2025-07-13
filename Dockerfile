FROM node:22.17.0-alpine3.22

# Install system dependencies
RUN apk update && apk add --no-cache \
    curl ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy built application
COPY build/ ./build/

# Create health check endpoint script
RUN echo '#!/bin/bash\n\
    echo "OK"' > /usr/local/bin/health-check

RUN chmod +x /usr/local/bin/health-check

# Create non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp
RUN chown -R mcp:mcp /app
USER mcp

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD /usr/local/bin/health-check

# Default command
CMD ["node", "build/index.js"]