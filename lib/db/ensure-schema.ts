import "server-only"
import { sql } from "drizzle-orm"
import { db, hasDatabaseUrl } from "./index"

/**
 * Idempotent, self-healing DDL for the People ↔ Organizations relationship.
 *
 * This project manages its schema manually (no migration files). To guarantee the relational
 * columns and constraints the app relies on always exist — even on a database provisioned
 * before this feature — we run a set of guarded, `IF NOT EXISTS`-style statements once per
 * server process. The result is cached so the cost is paid at most once.
 *
 * Each statement is wrapped in its own try/catch: a unique-constraint creation can legitimately
 * fail if legacy rows already contain duplicates. In that case we log and continue — the
 * application-level de-duplication in the sync layer still prevents new duplicates, and the
 * rest of the schema is applied.
 */
let ensured: Promise<void> | null = null

async function exec(label: string, statement: ReturnType<typeof sql>) {
  try {
    await db.execute(statement)
  } catch (error) {
    console.error(`[ensure-schema] ${label} skipped:`, error instanceof Error ? error.message : error)
  }
}

async function run() {
  if (!hasDatabaseUrl()) return

  // 1) people.organization_id column (the FK payload).
  await exec(
    "add people.organization_id",
    sql`ALTER TABLE people ADD COLUMN IF NOT EXISTS organization_id integer`,
  )

  // 2) Foreign key people.organization_id -> organizations.id (ON DELETE SET NULL so deleting an
  //    organization unlinks its people rather than destroying them).
  await exec(
    "add people_organization_id_fkey",
    sql`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'people_organization_id_fkey'
        ) THEN
          ALTER TABLE people
            ADD CONSTRAINT people_organization_id_fkey
            FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL;
        END IF;
      END
    $$;`,
  )

  // 3) Prevent duplicate organizations by (case-insensitive) name.
  await exec(
    "unique organizations name",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_lower_unique ON organizations (lower(name))`,
  )

  // 4) Prevent duplicate people by (case-insensitive) email. Partial index so the many rows
  //    without an email are unaffected.
  await exec(
    "unique people email",
    sql`CREATE UNIQUE INDEX IF NOT EXISTS people_email_lower_unique ON people (lower(email)) WHERE email IS NOT NULL AND email <> ''`,
  )

  // 5) Helpful lookup index for "members of an organization" queries.
  await exec(
    "index people.organization_id",
    sql`CREATE INDEX IF NOT EXISTS people_organization_id_idx ON people (organization_id)`,
  )
}

/** Ensure the relational schema exists. Cached: the DDL runs at most once per process. */
export function ensureRelationalSchema(): Promise<void> {
  if (!ensured) ensured = run()
  return ensured
}
