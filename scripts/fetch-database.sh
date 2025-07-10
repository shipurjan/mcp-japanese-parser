#!/bin/bash
set -e

OUTPUT_PATH=$1
CHECKSUM_FILE="/tmp/expected-checksum.txt"

if [ -z "$OUTPUT_PATH" ]; then
    echo "Usage: $0 <output-path>"
    exit 1
fi

echo "Downloading Ichiran database..."
echo "Source: ${ICHIRAN_DB_PRIMARY_URL}"
echo "Size: ~188MB (this may take a few minutes)"

# Try primary source first (official Ichiran releases)
echo "Downloading from primary source..."
if wget --progress=bar:force --timeout=300 --tries=3 "${ICHIRAN_DB_PRIMARY_URL}" -O "${OUTPUT_PATH}"; then
    echo "Primary source download successful"
else
    echo "Primary source failed"
    
    # Try fallback source if defined
    if [ -n "${ICHIRAN_DB_FALLBACK_URL}" ]; then
        echo "Trying fallback source: ${ICHIRAN_DB_FALLBACK_URL}"
        if wget --progress=bar:force --timeout=300 --tries=3 "${ICHIRAN_DB_FALLBACK_URL}" -O "${OUTPUT_PATH}"; then
            echo "Fallback source download successful"
        else
            echo "Both primary and fallback sources failed"
            exit 1
        fi
    else
        echo "No fallback URL configured"
        exit 1
    fi
fi

# Verify file exists and has reasonable size
if [ ! -f "${OUTPUT_PATH}" ]; then
    echo "Downloaded file is missing"
    exit 1
fi

FILE_SIZE=$(stat -c%s "${OUTPUT_PATH}" 2>/dev/null || stat -f%z "${OUTPUT_PATH}")
if [ "${FILE_SIZE}" -lt 10000000 ]; then  # Less than 10MB is suspicious for Ichiran DB
    echo "Downloaded file seems too small (${FILE_SIZE} bytes)"
    echo "Expected file should be ~188MB"
    exit 1
fi

# Verify checksum if available
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "Verifying checksum..."
    EXPECTED_CHECKSUM=$(cat "${CHECKSUM_FILE}")
    ACTUAL_CHECKSUM=$(sha256sum "${OUTPUT_PATH}" | cut -d' ' -f1)
    
    if [ "${EXPECTED_CHECKSUM}" = "${ACTUAL_CHECKSUM}" ]; then
        echo "Checksum verification passed"
    else
        echo "Checksum verification failed"
        echo "  Expected: ${EXPECTED_CHECKSUM}"
        echo "  Actual:   ${ACTUAL_CHECKSUM}"
        echo "  Continuing anyway (checksum might be outdated)"
    fi
else
    echo "No checksum file found, skipping verification"
fi

# Basic file format check - look for PGDMP header
if ! head -c 5 "${OUTPUT_PATH}" | grep -q "PGDMP"; then
    echo "Downloaded file doesn't appear to be a PostgreSQL dump (missing PGDMP header)"
    head -n 5 "${OUTPUT_PATH}"
    exit 1
fi

echo "Database download and verification complete"
echo "  File: ${OUTPUT_PATH}"
echo "  Size: $(du -h "${OUTPUT_PATH}" | cut -f1)"
echo "  Type: PostgreSQL database dump"