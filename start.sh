#!/bin/sh
# AstroBidhi startup script
# Initializes SQLite database if needed, then starts the server

echo "[Startup] AstroBidhi starting..."

# Determine data directory
DATA_DIR="/data"
DB_FILE="${DATA_DIR}/astrobidhi.db"

# Create data directory if it doesn't exist (e.g., first run without volume)
if [ ! -d "$DATA_DIR" ]; then
  echo "[Startup] Creating data directory: $DATA_DIR"
  mkdir -p "$DATA_DIR"
fi

# Check if volume is writable
if touch "$DATA_DIR/.write_test" 2>/dev/null; then
  rm -f "$DATA_DIR/.write_test"
  echo "[Startup] Data directory is writable: $DATA_DIR"
else
  echo "[Startup] WARNING: Data directory not writable: $DATA_DIR, falling back to /tmp"
  DATA_DIR="/tmp/astrobidhi-data"
  mkdir -p "$DATA_DIR"
  DB_FILE="${DATA_DIR}/astrobidhi.db"
fi

# Export DATABASE_URL for Prisma
export DATABASE_URL="file:${DB_FILE}"
echo "[Startup] Database URL: $DATABASE_URL"
echo "[Startup] Database file: $DB_FILE (exists: $([ -f "$DB_FILE" ] && echo 'YES' || echo 'NO'))"

# Check if Prisma is available
if [ -f "node_modules/.prisma/client/index.js" ] || [ -d "node_modules/@prisma/client" ]; then
  echo "[Startup] Initializing database..."
  # Run prisma db push to create/migrate the SQLite database
  # This is safe to run multiple times (idempotent)
  npx prisma db push --skip-generate 2>&1 || echo "[Startup] DB init skipped (may already exist)"
  echo "[Startup] Database ready (exists: $([ -f "$DB_FILE" ] && echo 'YES' || echo 'NO'))"
else
  echo "[Startup] Prisma client not found — database features will be disabled"
fi

echo "[Startup] Starting server on port $PORT..."
exec node server.js
