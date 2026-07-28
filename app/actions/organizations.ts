"use server"

import { db } from "@/lib/db"
import { withDb } from "@/lib/db/with-db"
import {
  organizations,
  eventsOrganizations,
  programsOrganizations,
  events,
  programs,
  people,
} from "@/lib/db/schema"
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserId } from "@/lib/admin-helpers"
import { resolveOptionalImage } from "@/lib/images"
import { findOrCreateOrganizationByName, normalizeName } from "@/lib/organizations-sync"
import { importExistingOrganizations } from "@/lib/organizations-import"
import { defaultTagForType } from "@/lib/organization-types"
import type {
  Organization,
  OrgConnection,
  DirectoryOrganization,
  AdminOrganization,
  OrganizationInput,
  EventProgramOptions,
} from "@/lib/organization-types"

function resolveOrg<T extends { logoUrl?: string | null }>(row: T): T {
  return { ...row, logoUrl: resolveOptionalImage(row.logoUrl ?? null) }
}

function pushUnique(list: OrgConnection[], conn: OrgConnection) {
  if (!list.some((c) => c.id === conn.id)) list.push(conn)
}

// ---- Public reads ----

/**
 * Public organizations directory. The central `organizations` table is the single source of
 * truth — members, partners, event sponsors and program partners/startups are all synced
 * into it. Only approved organizations are returned, each with the events and programs they
 * are connected to (for the Members List filters).
 */
export async function getOrganizationsDirectory(): Promise<DirectoryOrganization[]> {
  return withDb(async () => {
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.status, "approved"))
      .orderBy(asc(organizations.sortOrder), asc(organizations.name))

    const byId = new Map<number, DirectoryOrganization>()
    const result: DirectoryOrganization[] = rows.map((r) => {
      const entry: DirectoryOrganization = { ...resolveOrg(r), events: [], programs: [] }
      byId.set(r.id, entry)
      return entry
    })

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const [eventLinks, programLinks] = await Promise.all([
        db
          .select({
            organizationId: eventsOrganizations.organizationId,
            id: events.id,
            title: events.title,
            slug: events.slug,
          })
          .from(eventsOrganizations)
          .innerJoin(events, eq(events.id, eventsOrganizations.eventId))
          .where(inArray(eventsOrganizations.organizationId, ids))
          .orderBy(asc(eventsOrganizations.sortOrder)),
        db
          .select({
            organizationId: programsOrganizations.organizationId,
            id: programs.id,
            title: programs.title,
            slug: programs.slug,
          })
          .from(programsOrganizations)
          .innerJoin(programs, eq(programs.id, programsOrganizations.programId))
          .where(inArray(programsOrganizations.organizationId, ids))
          .orderBy(asc(programsOrganizations.sortOrder)),
      ])
      for (const l of eventLinks) {
        const entry = byId.get(l.organizationId)
        if (entry) pushUnique(entry.events, { id: l.id, title: l.title, slug: l.slug })
      }
      for (const l of programLinks) {
        const entry = byId.get(l.organizationId)
        if (entry) pushUnique(entry.programs, { id: l.id, title: l.title, slug: l.slug })
      }
    }

    // The central `organizations` table is the single source of truth. Legacy members/partners
    // are migrated into it (see migrateLegacyOrganizations) rather than merged at read time, so
    // every company appears exactly once.
    return result
  }, [])
}

/**
 * Companies eligible for the homepage "New Members" slider: approved AND flagged
 * showOnHomepage. Admins control inclusion per-company from the Organizations panel.
 * Event/program connections aren't needed here, so they're returned empty for speed.
 */
export async function getHomepageMembers(): Promise<DirectoryOrganization[]> {
  return withDb(async () => {
    const rows = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.status, "approved"), eq(organizations.showOnHomepage, true)))
      .orderBy(asc(organizations.sortOrder), asc(organizations.name))
    return rows.map((r) => ({ ...resolveOrg(r), events: [], programs: [] }))
  }, [])
}

export async function getOrganizationsForEvent(eventId: number): Promise<Organization[]> {
  return withDb(async () => {
    const links = await db
      .select()
      .from(eventsOrganizations)
      .where(eq(eventsOrganizations.eventId, eventId))
      .orderBy(asc(eventsOrganizations.sortOrder))
    const ids = links.map((l) => l.organizationId)
    if (ids.length === 0) return []
    const rows = await db
      .select()
      .from(organizations)
      .where(and(inArray(organizations.id, ids), eq(organizations.status, "approved")))
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(resolveOrg)
  }, [])
}

export async function getOrganizationsForProgram(programId: number): Promise<Organization[]> {
  return withDb(async () => {
    const links = await db
      .select()
      .from(programsOrganizations)
      .where(eq(programsOrganizations.programId, programId))
      .orderBy(asc(programsOrganizations.sortOrder))
    const ids = links.map((l) => l.organizationId)
    if (ids.length === 0) return []
    const rows = await db
      .select()
      .from(organizations)
      .where(and(inArray(organizations.id, ids), eq(organizations.status, "approved")))
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(resolveOrg)
  }, [])
}

// ---- Admin reads ----

export async function getMyOrganizations(): Promise<AdminOrganization[]> {
  await getUserId()
  return withDb(async () => {
    const rows = await db
      .select()
      .from(organizations)
      .orderBy(asc(organizations.sortOrder), asc(organizations.name))
    const ids = rows.map((r) => r.id)
    const eventsByOrg = new Map<number, OrgConnection[]>()
    const programsByOrg = new Map<number, OrgConnection[]>()
    for (const id of ids) {
      eventsByOrg.set(id, [])
      programsByOrg.set(id, [])
    }
    if (ids.length > 0) {
      const [eventLinks, programLinks] = await Promise.all([
        db
          .select({
            organizationId: eventsOrganizations.organizationId,
            id: events.id,
            title: events.title,
            slug: events.slug,
          })
          .from(eventsOrganizations)
          .innerJoin(events, eq(events.id, eventsOrganizations.eventId))
          .where(inArray(eventsOrganizations.organizationId, ids))
          .orderBy(asc(eventsOrganizations.sortOrder)),
        db
          .select({
            organizationId: programsOrganizations.organizationId,
            id: programs.id,
            title: programs.title,
            slug: programs.slug,
          })
          .from(programsOrganizations)
          .innerJoin(programs, eq(programs.id, programsOrganizations.programId))
          .where(inArray(programsOrganizations.organizationId, ids))
          .orderBy(asc(programsOrganizations.sortOrder)),
      ])
      for (const l of eventLinks) pushUnique(eventsByOrg.get(l.organizationId)!, { id: l.id, title: l.title, slug: l.slug })
      for (const l of programLinks)
        pushUnique(programsByOrg.get(l.organizationId)!, { id: l.id, title: l.title, slug: l.slug })
    }

    // People linked to each organization (the one-to-many relationship).
    const membersByOrg = new Map<number, { id: number; fullName: string; jobTitle: string | null; profilePhoto: string | null; status: string }[]>()
    if (ids.length > 0) {
      const memberRows = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          jobTitle: people.jobTitle,
          profilePhoto: people.profilePhoto,
          status: people.status,
          organizationId: people.organizationId,
        })
        .from(people)
        .where(inArray(people.organizationId, ids))
        .orderBy(asc(people.sortOrder), asc(people.id))
      for (const m of memberRows) {
        if (m.organizationId == null) continue
        const list = membersByOrg.get(m.organizationId) ?? []
        list.push({
          id: m.id,
          fullName: m.fullName,
          jobTitle: m.jobTitle,
          profilePhoto: resolveOptionalImage(m.profilePhoto),
          status: m.status,
        })
        membersByOrg.set(m.organizationId, list)
      }
    }

    return rows.map((r) => {
      const evs = eventsByOrg.get(r.id) ?? []
      const prs = programsByOrg.get(r.id) ?? []
      const members = membersByOrg.get(r.id) ?? []
      return {
        ...r,
        eventCount: evs.length,
        programCount: prs.length,
        memberCount: members.length,
        members,
        events: evs,
        programs: prs,
      }
    })
  }, [])
}

/** All events and programs as lightweight options for the member connection pickers. */
export async function getEventProgramOptions(): Promise<EventProgramOptions> {
  await getUserId()
  return withDb(
    async () => {
      const [ev, pr] = await Promise.all([
        db.select({ id: events.id, title: events.title }).from(events).orderBy(asc(events.title)),
        db.select({ id: programs.id, title: programs.title }).from(programs).orderBy(asc(programs.title)),
      ])
      return { events: ev, programs: pr }
    },
    { events: [], programs: [] },
  )
}

/** Lightweight option list for the event/program organization picker. */
export async function getOrganizationOptions(): Promise<{ id: number; name: string; subtitle: string | null }[]> {
  await getUserId()
  return withDb(async () => {
    const rows = await db
      .select()
      .from(organizations)
      .orderBy(asc(organizations.name))
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      subtitle: [r.type, r.country].filter(Boolean).join(" · ") || null,
    }))
  }, [])
}

export async function getOrganizationCounts() {
  await getUserId()
  return withDb(
    async () => {
      const rows = await db.select().from(organizations)
      const counts = { total: rows.length, approved: 0, pending: 0, hidden: 0 }
      const byType: Record<string, number> = {}
      for (const r of rows) {
        if (r.status === "approved") counts.approved++
        else if (r.status === "pending") counts.pending++
        else if (r.status === "hidden") counts.hidden++
        byType[r.type] = (byType[r.type] ?? 0) + 1
      }
      return { counts, byType }
    },
    { counts: { total: 0, approved: 0, pending: 0, hidden: 0 }, byType: {} as Record<string, number> },
  )
}

// ---- Admin writes ----

/** Throw if another organization (besides `excludeId`) already uses this name. */
async function assertNoDuplicate(name: string, excludeId?: number) {
  const key = normalizeName(name)
  const where = excludeId
    ? and(sql`lower(${organizations.name}) = ${key}`, ne(organizations.id, excludeId))
    : sql`lower(${organizations.name}) = ${key}`
  const existing = await db.select({ id: organizations.id }).from(organizations).where(where).limit(1)
  if (existing[0]) {
    throw new Error(`An organization named "${name.trim()}" already exists.`)
  }
}

function normalizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = (raw || "").trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function normalize(input: OrganizationInput) {
  return {
    name: input.name.trim(),
    type: input.type || "Member",
    tags: normalizeTags(input.tags),
    logoUrl: input.logoUrl || null,
    websiteUrl: input.websiteUrl || null,
    country: input.country || null,
    industry: input.industry || null,
    description: input.description || null,
    status: input.status || "approved",
    featured: input.featured ?? false,
    showOnHomepage: input.showOnHomepage ?? true,
    sortOrder: input.sortOrder ?? 0,
  }
}

export async function createOrganization(input: OrganizationInput): Promise<number> {
  const userId = await getUserId()
  if (!input.name?.trim()) throw new Error("Organization name is required.")
  await assertNoDuplicate(input.name)
  const [row] = await db
    .insert(organizations)
    .values({ ...normalize(input), authorId: userId })
    .returning({ id: organizations.id })
  revalidatePath("/members")
  revalidatePath("/")
  return row.id
}

/**
 * Rebuild which events and programs this organization is connected to, editable directly
 * from the member (organizations) area. A single organization can be linked to any number
 * of events and programs.
 */
export async function setOrganizationConnections(orgId: number, eventIds: number[], programIds: number[]) {
  await getUserId()
  const evIds = Array.from(new Set(eventIds.map(Number).filter((n) => Number.isFinite(n))))
  const prIds = Array.from(new Set(programIds.map(Number).filter((n) => Number.isFinite(n))))

  await db.delete(eventsOrganizations).where(eq(eventsOrganizations.organizationId, orgId))
  if (evIds.length > 0) {
    await db
      .insert(eventsOrganizations)
      .values(evIds.map((eventId, i) => ({ eventId, organizationId: orgId, sortOrder: i })))
  }

  await db.delete(programsOrganizations).where(eq(programsOrganizations.organizationId, orgId))
  if (prIds.length > 0) {
    await db
      .insert(programsOrganizations)
      .values(prIds.map((programId, i) => ({ programId, organizationId: orgId, sortOrder: i })))
  }

  revalidatePath("/members")
  revalidatePath("/")
  revalidatePath("/events")
  revalidatePath("/programs")
}

export async function updateOrganization(id: number, input: OrganizationInput) {
  await getUserId()
  if (!input.name?.trim()) throw new Error("Organization name is required.")
  await assertNoDuplicate(input.name, id)
  await db
    .update(organizations)
    .set({ ...normalize(input), updatedAt: new Date() })
    .where(eq(organizations.id, id))
  revalidatePath("/members")
  revalidatePath("/")
}

export async function setOrganizationStatus(id: number, status: "approved" | "pending" | "hidden") {
  await getUserId()
  await db.update(organizations).set({ status, updatedAt: new Date() }).where(eq(organizations.id, id))
  revalidatePath("/members")
  revalidatePath("/")
}

/** Quick toggle for whether a company appears in the homepage "New Members" slider. */
export async function setOrganizationHomepage(id: number, showOnHomepage: boolean) {
  await getUserId()
  await db.update(organizations).set({ showOnHomepage, updatedAt: new Date() }).where(eq(organizations.id, id))
  revalidatePath("/")
  revalidatePath("/members")
}

export async function deleteOrganization(id: number) {
  await getUserId()
  // Keep the people, just detach them from the organization (mirrors ON DELETE SET NULL).
  await db.update(people).set({ organizationId: null, updatedAt: new Date() }).where(eq(people.organizationId, id))
  await db.delete(organizations).where(eq(organizations.id, id))
  await db.delete(eventsOrganizations).where(eq(eventsOrganizations.organizationId, id))
  await db.delete(programsOrganizations).where(eq(programsOrganizations.organizationId, id))
  revalidatePath("/members")
  revalidatePath("/team")
  revalidatePath("/")
}

/**
 * Quick-create used by the event/program picker. De-duplicates by name and reports back
 * whether the organization already existed (so the UI can warn). New entries are approved
 * so they appear on the Members List immediately.
 */
export async function quickCreateOrganization(input: { name: string; type?: string }) {
  await getUserId()
  const { id, duplicate } = await findOrCreateOrganizationByName({
    name: input.name,
    type: input.type || "Partner",
    status: "approved",
  })
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
  revalidatePath("/members")
  return {
    id,
    name: row.name,
    subtitle: [row.type, row.country].filter(Boolean).join(" · ") || null,
    duplicate,
  }
}

/**
 * One-time migration: bulk import existing members, partners, sponsors, and program orgs
 * into the central directory, then backfill a display tag for any organization that has
 * none (derived from its primary type). Idempotent — safe to run repeatedly.
 */
export async function importOrganizations() {
  await getUserId()
  const result = await importExistingOrganizations()

  // Backfill tags for organizations that don't have any yet.
  const untagged = await db
    .select()
    .from(organizations)
    .where(sql`${organizations.tags} = '[]'::jsonb OR ${organizations.tags} IS NULL`)
  let tagged = 0
  for (const org of untagged) {
    await db
      .update(organizations)
      .set({ tags: [defaultTagForType(org.type)], updatedAt: new Date() })
      .where(eq(organizations.id, org.id))
    tagged++
  }

  revalidatePath("/members")
  revalidatePath("/")
  return { ...result, tagged }
}
