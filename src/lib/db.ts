// Prisma client singleton with lazy initialization
// Safe at build time — PrismaClient is only constructed when first accessed at runtime
// The top-level import is fine because prisma generate runs before next build

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null

function createPrismaClient(): PrismaClient {
  if (_db) return _db

  try {
    _db = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    })

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
    return _db
  } catch (error) {
    console.error('[DB] Failed to create PrismaClient:', error)
    throw error
  }
}

// Proxy that lazily creates the PrismaClient on first property access
// This way, importing { db } never crashes — it only crashes if you actually USE db
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = createPrismaClient()
    const value = (client as Record<string, unknown>)[prop as string]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
