#!/bin/sh
# AstroBidhi startup script
# Initializes SQLite database if needed, then starts the server

echo "[Startup] Checking database..."

# Run prisma db push to create/migrate the SQLite database
# This is safe to run multiple times (idempotent)
npx prisma db push --skip-generate 2>/dev/null || echo "[Startup] DB init skipped (Prisma not available or DB already exists)"

echo "[Startup] Starting server..."
exec node server.js
