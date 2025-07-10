# MCP Japanese Parser

A Model Context Protocol (MCP) server that provides Japanese text parsing capabilities to AI assistants using Ichiran's superior Japanese text segmentation and linguistic analysis.

## Features

- ✅ **Japanese text parsing** with dictionary information and segmentation
- ✅ **Romanization** with multiple schemes (Hepburn, Kunrei-shiki, Passport)
- ✅ **Kanji analysis** with detailed character information
- ✅ **Health monitoring** and service status checks
- ✅ **Rate limiting** and timeout management
- ✅ **Docker deployment** with full containerization
- ✅ **Error handling** with circuit breaker patterns

## Quick Start

This MCP server requires Ichiran to be running to provide real Japanese text parsing. There is no mock mode - you need the full setup.

```bash
# Clone the repository
git clone https://github.com/shipurjan/mcp-japanese-parser.git
cd mcp-japanese-parser

# Install dependencies
npm install

# Build the server
npm run build

# Start all services (Ichiran + PostgreSQL + MCP server)
docker-compose up -d --build

# Test the server
curl http://localhost:8080/health

# Run with MCP Inspector for testing
npx @modelcontextprotocol/inspector@latest node dist/index.js
```

The MCP Inspector will start at `http://localhost:6274` where you can test all the tools with real Japanese text processing.

## Environment Variables

### Core Server Configuration

| Variable          | Default      | Description                                      |
| ----------------- | ------------ | ------------------------------------------------ |
| `NODE_ENV`        | `production` | Environment mode (`development` or `production`) |
| `MCP_SERVER_PORT` | `8080`       | HTTP server port for health checks               |
| `MCP_TRANSPORT`   | `stdio`      | MCP transport method (`stdio` or `http`)         |

### Ichiran Integration

| Variable                 | Default | Description                                   |
| ------------------------ | ------- | --------------------------------------------- |
| `ICHIRAN_TIMEOUT`        | `30000` | Timeout for Ichiran operations (milliseconds) |
| `ICHIRAN_MAX_CONCURRENT` | `10`    | Maximum concurrent Ichiran requests           |

### Performance and Limits

| Variable          | Default | Description                            |
| ----------------- | ------- | -------------------------------------- |
| `RATE_LIMIT_MAX`  | `60`    | Maximum requests per minute per client |
| `MAX_TEXT_LENGTH` | `10000` | Maximum input text length (characters) |
| `MAX_BATCH_SIZE`  | `50`    | Maximum texts in batch processing      |
| `CACHE_TTL`       | `3600`  | Cache time-to-live (seconds)           |

### Database Configuration (PostgreSQL)

| Variable              | Default                                                | Description                     |
| --------------------- | ------------------------------------------------------ | ------------------------------- |
| `DATABASE_URL`        | `postgresql://ichiran:ichiran@ichiran-db:5432/ichiran` | Full database connection string |
| `ICHIRAN_DB_HOST`     | `ichiran-db`                                           | Database host                   |
| `ICHIRAN_DB_PORT`     | `5432`                                                 | Database port                   |
| `ICHIRAN_DB_NAME`     | `ichiran`                                              | Database name                   |
| `ICHIRAN_DB_USER`     | `ichiran`                                              | Database username               |
| `ICHIRAN_DB_PASSWORD` | `ichiran`                                              | Database password               |

### Development and Debugging

| Variable | Default     | Description                          |
| -------- | ----------- | ------------------------------------ |
| `DEBUG`  | `undefined` | Enable debug logging (e.g., `mcp:*`) |

## Requirements

- **Docker and Docker Compose** for running Ichiran containers
- **8GB+ RAM** for the full JMDict database
- **10GB+ disk space** for database and container images
- **Network access** for downloading the database during build

## Available Tools

### `parse_japanese_text`

Parse Japanese text with dictionary information and segmentation.

**Input:**

```json
{
  "text": "日本語上手ですね",
  "options": {
    "includeInfo": true,
    "limit": 5
  }
}
```

**Output:** Detailed word breakdown with definitions, part-of-speech, and confidence scores.

### `romanize_japanese`

Convert Japanese text to romanized form.

**Input:**

```json
{
  "text": "こんにちは",
  "scheme": "hepburn",
  "includeInfo": false
}
```

**Output:** Romanized text with optional word information.

### `analyze_kanji`

Analyze kanji characters for readings, stroke count, and meanings.

**Input:**

```json
{
  "kanji": "漢字"
}
```

**Output:** Detailed kanji analysis including readings and stroke information.

### `health_check`

Check the health status of the Ichiran service and server.

**Input:** `{}` (no parameters)

**Output:** Service health status, circuit breaker state, and environment info.

## Development Setup

### Prerequisites

- **Docker and Docker Compose** - Required for running Ichiran
- **Node.js 18+** - For the MCP server
- **8GB+ RAM** - For the JMDict database
- **10GB+ disk space** - For database and container images
- **Stable internet connection** - For downloading the 188MB database

### Step-by-Step Development Guide

**1. Clone and Setup**

```bash
# Clone the repository
git clone https://github.com/shipurjan/mcp-japanese-parser.git
cd mcp-japanese-parser

# Install Node.js dependencies
npm install

# Format and lint code (ensure everything is clean)
npm run format && npm run lint && npm run lint:types

# Build the TypeScript code
npm run build
```

**2. Start the Ichiran Services**

```bash
# Build and start all Docker services (this will take 5-10 minutes on first run)
# The database download and Ichiran compilation happens during build
docker-compose up -d --build

# Monitor the startup process (important for first run)
docker-compose logs -f
```

**Wait for the following log messages before proceeding:**

- `ichiran-db` service: "database system is ready to accept connections"
- `ichiran-main` service: "ichiran-cli built successfully" and "Ichiran setup complete"

**3. Verify Ichiran is Working**

```bash
# Test the ichiran-cli directly
docker exec ichiran-main ichiran-cli "こんにちは"

# Should output romanization like: "konnichiwa"
```

**4. Run the MCP Server**

```bash
# Start the MCP server in development mode
node dist/index.js

# The server will communicate with Ichiran via docker exec
```

**5. Test with MCP Inspector**

```bash
# In a new terminal, start the MCP Inspector for testing
npx @modelcontextprotocol/inspector@latest node dist/index.js

# Open http://localhost:6274 in your browser
# Test the tools with Japanese text like "日本語上手ですね"
```

### Development Workflow

**Making Code Changes:**

```bash
# After modifying TypeScript files:
npm run build

# Restart the MCP server:
# Ctrl+C to stop, then:
node dist/index.js
```

**Docker Service Management:**

```bash
# View service status
docker-compose ps

# View logs for specific service
docker-compose logs ichiran-main
docker-compose logs ichiran-db

# Restart services if needed
docker-compose restart ichiran-main

# Clean rebuild (if issues occur)
docker-compose down
docker-compose up -d --build
```

### Common Development Issues

**1. "No such container: ichiran-main"**

```bash
# Solution: Start the Docker services
docker-compose up -d --build
docker-compose ps  # Verify all services are running
```

**2. "Database not ready" errors**

```bash
# Check database logs
docker-compose logs ichiran-db

# Wait longer - database initialization takes time
# Look for "database system is ready to accept connections"
```

**3. Ichiran build failures**

```bash
# Check build logs
docker-compose logs ichiran-main

# Common causes: insufficient memory, network issues during download
# Solution: Ensure 8GB+ RAM and stable internet
```

**4. MCP server connection errors**

```bash
# Verify ichiran-cli is working
docker exec ichiran-main ichiran-cli --help

# Check if ichiran-cli binary exists
docker exec ichiran-main ls -la /usr/local/bin/ichiran-cli
```

### Testing the Tools

Use the MCP Inspector to test each tool:

**parse_japanese_text:**

```json
{
  "text": "日本語上手ですね",
  "options": { "includeInfo": true, "limit": 3 }
}
```

**romanize_japanese:**

```json
{
  "text": "こんにちは世界",
  "scheme": "hepburn",
  "includeInfo": false
}
```

**analyze_kanji:**

```json
{
  "kanji": "漢字"
}
```

**health_check:**

```json
{}
```

## Production Deployment

### Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build MCP server image
docker build -f Dockerfile.mcp -t mcp-japanese-parser .

# Run with environment variables
docker run -e NODE_ENV=production -p 8080:8080 mcp-japanese-parser
```

## Troubleshooting

### Common Issues

1. **"No such container: ichiran-main"**
   - **Solution**: Run `docker-compose up -d --build` to start Ichiran containers
   - **Check**: Verify containers are running with `docker-compose ps`

2. **Database download fails during build**
   - **Solution**: Ensure stable internet connection and sufficient disk space
   - **Alternative**: Check if the database URL is accessible manually

3. **Rate limit exceeded errors**
   - **Solution**: Increase `RATE_LIMIT_MAX` or wait for rate limit reset
   - **Default**: 60 requests per minute

4. **Timeout errors**
   - **Solution**: Increase `ICHIRAN_TIMEOUT` for complex texts
   - **Default**: 30 seconds

5. **Memory issues**
   - **Solution**: Ensure at least 8GB RAM for full database
   - **Docker**: Increase Docker memory limits if needed

6. **Container build failures**
   - **Solution**: Ensure Docker has sufficient resources allocated
   - **Check**: Verify network access to download dependencies

### Health Checks

```bash
# Check MCP server health
curl http://localhost:8080/health

# Check Docker container status
docker-compose ps

# View server logs
docker-compose logs mcp-server
```

## License

AGPL-3.0-or-later

## Credits

Powered by [Ichiran](https://github.com/tshatrov/ichiran) - Advanced Japanese text segmentation and linguistic analysis engine by tshatrov.

JMDict database by the Electronic Dictionary Research and Development Group.
