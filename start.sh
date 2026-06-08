#!/bin/sh
# AstroBidhi startup script
# Database: Turso (managed libSQL) — no local SQLite files needed

echo "[Startup] AstroBidhi starting..."

# Check Turso env vars
if [ -n "$DATABASE_URL" ] || [ -n "$TURSO_DATABASE_URL" ]; then
  echo "[Startup] ✅ Turso database URL configured"
else
  echo "[Startup] ⚠️ WARNING: No DATABASE_URL or TURSO_DATABASE_URL set — caching will be disabled"
fi

if [ -n "$TURSO_AUTH_TOKEN" ]; then
  echo "[Startup] ✅ Turso auth token configured"
else
  echo "[Startup] ⚠️ WARNING: No TURSO_AUTH_TOKEN set — may not be able to connect to Turso"
fi

# Create temp directory for Python script I/O
mkdir -p /tmp/astrobidi-api 2>/dev/null

echo "[Startup] Starting server on port $PORT..."
exec node server.js
