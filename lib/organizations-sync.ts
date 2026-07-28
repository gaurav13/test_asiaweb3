import "server-only"
import { db } from "@/lib/db"
import {
  organizations,
  eventsOrganizations,
  programsOrganizations,
  newsOrganizations,
  type EventSponsor,
  type ProgramPartner,
  type ProgramStartup,
} from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { getUserId } from "@/lib/admin-helpers"

export function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

/**
 * Find an organization by (case-insensitive) name, creating one if none exists.
 * Existing organizations are never overwritten — admin edits in the Organizations area
 * are preserved. Returns the organization id.
 */
export async function findOrCreateOrganizationByName(
  input: {
    name: string
    type?: string
    tags?: string[]
    logoUrl?: string | null
    websiteUrl?: string | null
    country?: string | null
    industry?: string | null
    description?: string | null
    status?: string
  },
  opts?: { authorId?: string },
): Promise<{ id: number; duplicate: boolean }> {
  const cleanName = input.name.trim()
  if (!cleanName) throw new Error("Organization name is required.")
  const key = normalizeName(cleanName)
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(sql`lower(${organizations.name}) = ${key}`)
    .limit(1)
  if (existing[0]) return { id: existing[0].id, duplicate: true }

  // Public submissions have no authenticated user — fall back to a system author id.
  const userId = opts?.authorId ?? (await getUserId())
  const [row] = await db
    .insert(organizations)
    .values({
      name: cleanName,
      type: input.type || "Member",
      tags: input.tags ?? [],
      logoUrl: input.logoUrl || null,
      websiteUrl: input.websiteUrl || null,
      country: input.country || null,
      industry: input.industry || null,
      description: input.description || null,
      status: input.status || "approved",
      featured: false,
      sortOrder: 0,
      authorId: userId,
    })
    .returning({ id: organizations.id })
  return { id: row.id, duplicate: false }
}

/** Create or update a central organization from legacy member/partner data. */
export async function upsertOrganizationFromLegacy(input: {
  name: string
  type?: string
  logoUrl?: string | null
  websiteUrl?: string | null
  description?: string | null
  sortOrder?: number
}) {
  const cleanName = input.name.trim()
  if (!cleanName) return null

  const key = normalizeName(cleanName)
  const existing = await db
    .select()
    .from(organizations)
    .where(sql`lower(${organizations.name}) = ${key}`)
    .limit(1)

  if (existing[0]) {
    await db
      .update(organizations)
      .set({
        type: input.type || existing[0].type,
        logoUrl: input.logoUrl ?? existing[0].logoUrl,
        websiteUrl: input.websiteUrl ?? existing[0].websiteUrl,
        description: input.description ?? existing[0].description,
        sortOrder: input.sortOrder ?? existing[0].sortOrder,
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, existing[0].id))
    return existing[0].id
  }

  const { id } = await findOrCreateOrganizationByName({
    name: cleanName,
    type: input.type || "Member",
    logoUrl: input.logoUrl,
    websiteUrl: input.websiteUrl,
    description: input.description,
    status: "approved",
  })
  return id
}

/** Upsert an event's free-text sponsors into the central directory. Returns their ids. */
export async function importEventSponsors(sponsors: EventSponsor[] = []): Promise<number[]> {
  const ids: number[] = []
  for (const s of sponsors) {
    if (!s.name?.trim()) continue
    const { id } = await findOrCreateOrganizationByName({
      name: s.name,
      type: "Sponsor",
      tags: ["Sponsor"],
      logoUrl: s.logoUrl,
      websiteUrl: s.linkUrl,
    })
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Upsert a program's free-text partners into the central directory. Returns their ids. */
export async function importProgramPartners(partners: ProgramPartner[] = []): Promise<number[]> {
  const ids: number[] = []
  for (const p of partners) {
    if (!p.name?.trim()) continue
    const { id } = await findOrCreateOrganizationByName({
      name: p.name,
      type: "Partner",
      tags: ["Event Partner"],
      logoUrl: p.logoUrl,
      websiteUrl: p.linkUrl,
    })
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Upsert a program's free-text startups into the central directory. Returns their ids. */
export async function importProgramStartups(startups: ProgramStartup[] = []): Promise<number[]> {
  const ids: number[] = []
  for (const s of startups) {
    if (!s.name?.trim()) continue
    const { id } = await findOrCreateOrganizationByName({
      name: s.name,
      type: "Startup",
      tags: ["Startup Member"],
      logoUrl: s.logoUrl,
      websiteUrl: s.linkUrl,
      description: s.description,
    })
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Rebuild an event's organization connections from the supplied ids (de-duplicated). */
export async function syncEventOrganizationConnections(eventId: number, organizationIds: number[] = []) {
  await db.delete(eventsOrganizations).where(eq(eventsOrganizations.eventId, eventId))
  const ids = Array.from(new Set(organizationIds.map(Number).filter((n) => Number.isFinite(n))))
  if (ids.length > 0) {
    await db
      .insert(eventsOrganizations)
      .values(ids.map((organizationId, i) => ({ eventId, organizationId, sortOrder: i })))
  }
}

/** Rebuild a news article's organization connections from the supplied ids (de-duplicated). */
export async function syncNewsOrganizationConnections(newsId: number, organizationIds: number[] = []) {
  await db.delete(newsOrganizations).where(eq(newsOrganizations.newsId, newsId))
  const ids = Array.from(new Set(organizationIds.map(Number).filter((n) => Number.isFinite(n))))
  if (ids.length > 0) {
    await db.insert(newsOrganizations).values(ids.map((organizationId, i) => ({ newsId, organizationId, sortOrder: i })))
  }
}

/** Rebuild a program's organization connections from the supplied ids (de-duplicated). */
export async function syncProgramOrganizationConnections(programId: number, organizationIds: number[] = []) {
  await db.delete(programsOrganizations).where(eq(programsOrganizations.programId, programId))
  const ids = Array.from(new Set(organizationIds.map(Number).filter((n) => Number.isFinite(n))))
  if (ids.length > 0) {
    await db
      .insert(programsOrganizations)
      .values(ids.map((organizationId, i) => ({ programId, organizationId, sortOrder: i })))
  }
}
