# MCP Japanese Parser

A Model Context Protocol (MCP) server that provides Japanese text parsing capabilities to AI assistants using Ichiran's advanced Japanese text segmentation and linguistic analysis.

## 🚧 Current Status

**Core MVP implemented** - functional tools and Docker integration complete, but **not yet production ready**.

**Missing for production:**

- Real LLM integration testing (Claude Desktop, etc.)
- Easy installation package
- User documentation and setup guides
- End-to-end workflow validation

## What This Does

Provides AI assistants with superior Japanese text analysis:

- **Text parsing** with dictionary definitions and segmentation
- **Romanization** with multiple schemes (Hepburn, Kunrei-shiki, Passport)
- **Kanji analysis** with readings and stroke information
- **Health monitoring** of service status

Unlike basic tokenizers, this uses Ichiran's advanced algorithms that handle complex grammar patterns, contractions, and modern Japanese usage.

## Development Setup

**Prerequisites:** Docker, Docker Compose, Node.js 18+, 8GB+ RAM

```bash
# Clone and install
git clone https://github.com/shipurjan/mcp-japanese-parser.git
cd mcp-japanese-parser
npm install

# Build and start all services (takes 5-10 minutes first time)
npm run docker:build

# Test with MCP Inspector
npm run inspector
```

Open http://localhost:6274 to test the tools with Japanese text.

## Available Tools

- `parse_japanese_text` - Parse text with dictionary information
- `romanize_japanese` - Convert to romanized form with scheme options
- `analyze_kanji` - Analyze kanji characters for readings and info
- `health_check` - Check service status

## Requirements

- Docker and Docker Compose
- 8GB+ RAM (for JMDict database)
- 10GB+ disk space
- Network access for database download

## License

AGPL-3.0-or-later

## Credits

Powered by [Ichiran](https://github.com/tshatrov/ichiran) - Advanced Japanese text segmentation engine by tshatrov.

JMDict database by the Electronic Dictionary Research and Development Group.
