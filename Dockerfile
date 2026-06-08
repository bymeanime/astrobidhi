# ============================================
# AstroBidhi — Production Docker Image
# Next.js + Python + VedicAstro (Swiss Ephemeris)
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
COPY package.json bun.lock ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source code
COPY . .

# Generate Prisma client BEFORE build (Next.js needs it at build time)
RUN npx prisma generate

# Build Next.js (build script already runs prisma generate)
RUN npm run build

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

# Copy built Next.js app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + generated client + startup script
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/start.sh ./start.sh

# Copy Python scripts
COPY --from=builder /app/mini-services ./mini-services

# Create temp directory + data directory for SQLite
RUN mkdir -p /tmp/astrobidi-api && chown nextjs:nodejs /tmp/astrobidi-api
# Create /data for Railway Volume mount (persistent across deploys)
RUN mkdir -p /data && chown nextjs:nodejs /data && chmod +x ./start.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Default: use /data volume (Railway mounts persistent volume here)
# Fallback: /app/data for local dev without volume
ENV DATABASE_URL="file:/data/astrobidhi.db"

CMD ["./start.sh"]
