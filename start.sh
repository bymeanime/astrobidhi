#!/bin/sh
# AstroBidhi startup script
# Initializes SQLite database if needed, then starts the server

echo "[Startup] AstroBidhi starting..."

# Check if Prisma is available
if [ -f "node_modules/.prisma/client/index.js" ] || [ -d "node_modules/@prisma/client" ]; then
  echo "[Startup] Initializing database..."
  # Run prisma db push to create/migrate the SQLite database
  # This is safe to run multiple times (idempotent)
  npx prisma db push --skip-generate 2>&1 || echo "[Startup] DB init skipped (may already exist)"
else
  echo "[Startup] Prisma client not found — database features will be disabled"
fi

echo "[Startup] Starting server on port $PORT..."
exec node server.js
