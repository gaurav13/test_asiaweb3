import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/** Avoid pg v8 SSL deprecation warnings for Neon/Vercel `sslmode=require` URLs. */
function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined

  try {
    const parsed = new URL(url)
    const sslMode = parsed.searchParams.get("sslmode")
    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full")
      return parsed.toString()
    }
    return url
  } catch {
    return url.replace(
      /([?&])sslmode=(prefer|require|verify-ca)(&|$)/gi,
      "$1sslmode=verify-full$3",
    )
  }
}

export function getDatabaseUrl() {
  const raw =
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_2 ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_2 ??
    process.env.POSTGRES_PRISMA_URL

  return normalizeDatabaseUrl(raw)
}

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl())
}

export const pool = new Pool({ connectionString: getDatabaseUrl() })
export const db = drizzle(pool, { schema })
