# ============================================
# AstroBidhi — Production Docker Image
# Next.js + Python + VedicAstro (Swiss Ephemeris)
# Database: Turso (managed libSQL/SQLite)
# ============================================

# Stage 1: Install Python dependencies
FROM python:3.12-slim AS python-base

# Install git (for pip install from GitHub) + build tools (for pyswisseph compilation)
RUN apt-get update && apt-get install -y \
    git \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    vedicastro \
    git+https://github.com/diliprk/flatlib.git@sidereal#egg=flatlib

# Stage 2: Build Next.js
FROM node:20-slim AS builder

WORKDIR /app

# Install Python for build stage (needed for potential build-time scripts)
RUN apt-get update && apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy Python packages from python-base
COPY --from=python-base /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Install Node.js dependencies
COPY package.json package-lock.json bun.lock ./
RUN npm install 2>/dev/null || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Set dummy DATABASE_URL for Prisma generate (real URL comes from Railway at runtime)
ENV DATABASE_URL="file:./dev.db"

# Generate Prisma client BEFORE build (Next.js needs it at build time)
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# Fix standalone output: Next.js 16 Turbopack nests the output under directory structure
# Find server.js and flatten everything to /app/.next/standalone-flat/
RUN STANDALONE_DIR=$(find .next/standalone -name server.js -not -path "*/node_modules/*" | head -1 | xargs dirname) && \
    echo "Found standalone at: $STANDALONE_DIR" && \
    mkdir -p .next/standalone-flat && \
    cp -r $STANDALONE_DIR/* .next/standalone-flat/ && \
    cp -r $STANDALONE_DIR/.next .next/standalone-flat/ 2>/dev/null || true && \
    echo "Standalone flattened to .next/standalone-flat/" && \
    ls .next/standalone-flat/server.js && echo "✅ server.js confirmed at root"

# Stage 3: Production runtime — Python 3.12 base + Node.js 20
FROM python:3.12-slim AS runner

WORKDIR /app

# Install Node.js 20 from NodeSource (Next.js standalone needs node runtime)
RUN apt-get update && apt-get install -y curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    apt-get purge -y gnupg && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy site-packages with vedicastro, pyswisseph, flatlib from python-base
COPY --from=python-base /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Set environment variables
ENV NODE_ENV=production
ENV PYTHON_BIN=python3
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built Next.js app (flattened standalone)
COPY --from=builder /app/.next/standalone-flat ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client + startup script
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/start.sh ./start.sh

# Copy Python scripts
COPY --from=builder /app/mini-services ./mini-services

# Create temp directory for Python script I/O
RUN mkdir -p /tmp/astrobidi-api && chown nextjs:nodejs /tmp/astrobidi-api && chmod +x ./start.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# DO NOT set DATABASE_URL or TURSO_AUTH_TOKEN here — they come from Railway env vars
# Setting empty ENV values here would override Railway's real values

CMD ["./start.sh"]
