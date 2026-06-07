# ============================================
# AstroBidhi — Production Docker Image
# Next.js + Python + VedicAstro (Swiss Ephemeris)
# ============================================

# Stage 1: Install Python dependencies
FROM python:3.12-slim AS python-base

RUN pip install --no-cache-dir \
    vedicastro \
    git+https://github.com/diliprk/flatlib.git@sidereal#egg=flatlib

# Stage 2: Build Next.js
FROM node:20-slim AS builder

WORKDIR /app

# Install Python for runtime (needed for compute.py)
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Copy Python packages from python-base
COPY --from=python-base /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Install Node.js dependencies
COPY package.json bun.lock ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Stage 3: Production runtime
FROM node:20-slim AS runner

WORKDIR /app

# Install Python runtime
RUN apt-get update && apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy Python packages
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

# Copy Python scripts
COPY --from=builder /app/mini-services ./mini-services

# Create temp directory
RUN mkdir -p /tmp/astrobidi-api && chown nextjs:nodejs /tmp/astrobidi-api

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
