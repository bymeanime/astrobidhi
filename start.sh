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

# Initialize database using Prisma CLI if available
if [ -f "node_modules/.prisma/client/index.js" ] || [ -d "node_modules/@prisma/client" ]; then
  echo "[Startup] Prisma client found. Attempting DB init..."

  # Try prisma db push first (creates/migrates tables from schema)
  if npx prisma db push --skip-generate 2>&1; then
    echo "[Startup] ✅ Prisma db push succeeded — tables created/migrated"
  else
    echo "[Startup] ⚠️ Prisma db push failed — will try programmatic init via Node.js"

    # Fallback: Create tables directly using Node.js + Prisma
    node -e "
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const SQLS = [
        \`CREATE TABLE IF NOT EXISTS CachedAnalysis (
          id TEXT PRIMARY KEY,
          cacheKey TEXT NOT NULL UNIQUE,
          analysisType TEXT NOT NULL,
          chartData TEXT NOT NULL,
          result TEXT NOT NULL,
          provider TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )\`,
        \`CREATE INDEX IF NOT EXISTS CachedAnalysis_cacheKey_idx ON CachedAnalysis(cacheKey)\`,
        \`CREATE TABLE IF NOT EXISTS CachedStaticMeanings (
          id TEXT PRIMARY KEY,
          cacheKey TEXT NOT NULL UNIQUE,
          result TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )\`,
        \`CREATE INDEX IF NOT EXISTS CachedStaticMeanings_cacheKey_idx ON CachedStaticMeanings(cacheKey)\`,
      ];
      Promise.all(SQLS.map(sql => prisma.\$executeRawUnsafe(sql)))
        .then(() => { console.log('[Startup] ✅ Tables created via Node.js fallback'); process.exit(0); })
        .catch(e => { console.error('[Startup] ❌ Node.js fallback failed:', e.message); process.exit(1); });
    " 2>&1 && echo "[Startup] ✅ Programmatic init succeeded" || echo "[Startup] ⚠️ Programmatic init also failed — tables will be created on first API call"
  fi

  echo "[Startup] Database file: $DB_FILE (exists: $([ -f "$DB_FILE" ] && echo 'YES' || echo 'NO'))"
else
  echo "[Startup] ⚠️ Prisma client not found — database features will be disabled"
fi

echo "[Startup] Starting server on port $PORT..."
exec node server.js
