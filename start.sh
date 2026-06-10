#!/bin/sh
# AstroBidhi startup script
# Database: Turso (cloud) or local SQLite (auto-created)

echo "[Startup] AstroBidhi starting..."

# Check Turso env vars first
if [ -n "$TURSO_DATABASE_URL" ]; then
  echo "[Startup] ✅ Turso cloud database configured: $TURSO_DATABASE_URL"
  if [ -n "$TURSO_AUTH_TOKEN" ]; then
    echo "[Startup] ✅ Turso auth token configured"
  else
    echo "[Startup] ⚠️ WARNING: TURSO_DATABASE_URL set but no TURSO_AUTH_TOKEN"
  fi
elif [ -n "$DATABASE_URL" ]; then
  echo "[Startup] ✅ Database URL configured: $DATABASE_URL"
else
  echo "[Startup] ℹ️  No TURSO_DATABASE_URL or DATABASE_URL set — using auto-created local SQLite"
  # Check if /data is writable (Railway persistent volume)
  if [ -w /data ] 2>/dev/null; then
    echo "[Startup] ✅ /data is writable — database will persist across deploys"
  else
    echo "[Startup] ⚠️ /data is not writable — database will use /app/data or /tmp (may not persist)"
    echo "[Startup] 💡 Tip: Mount a Railway volume at /data for persistent storage"
  fi
fi

# Create temp directory for Python script I/O
mkdir -p /tmp/astrobidi-api 2>/dev/null
mkdir -p /data 2>/dev/null
mkdir -p /app/data 2>/dev/null

echo "[Startup] Starting server on port $PORT..."
exec node server.js
