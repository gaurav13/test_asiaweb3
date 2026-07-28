"use server"

import { db } from "@/lib/db"
import { withDb } from "@/lib/db/with-db"
import { people, eventsPeople, programsPeople, events, programs, teamMembers, organizations } from "@/lib/db/schema"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserId } from "@/lib/admin-helpers"
import { findOrCreatePersonByName, renumberPeopleByPriority, syncEventSpeakerPeople } from "@/lib/people-sync"
import { resolveOptionalImage, resolvePersonRecord } from "@/lib/images"

export type Person = typeof people.$inferSelect

/** A person row plus the (denormalised) name of the organization they belong to, for admin lists. */
export type PersonWithOrg = Person & { organizationName: string | null }

export type PersonInput = {
  fullName: string
  profilePhoto?: string
  jobTitle?: string
  companyName?: string
  companyLogo?: string
  linkedinUrl?: string
  email?: string
  country?: string
  bio?: string
  organizationId?: number | null
  roleTypes?: string[]
  tags?: string[]
  featured?: boolean
  status?: string
  sortOrder?: number
  showOnHomepage?: boolean
  showCompanyLogo?: boolean
  showLinkedin?: boolean
  showRoleBadge?: boolean
}

// ---- Public reads ----

export async function getHomepageLeaders(limit = 12): Promise<Person[]> {
  return withDb(
    () =>
      db
        .select()
        .from(people)
        .where(and(eq(people.showOnHomepage, true), eq(people.status, "published")))
        .orderBy(asc(people.sortOrder), asc(people.id))
        .limit(limit)
        .then((rows) => rows.map(resolvePersonRecord)),
    [],
  )
}

export async function getPublishedPeople(): Promise<Person[]> {
  return withDb(
    () =>
      db
        .select()
        .from(people)
        .where(eq(people.status, "published"))
        .orderBy(asc(people.sortOrder), asc(people.id))
        .then((rows) => rows.map(resolvePersonRecord)),
    [],
  )
}

export type PersonConnection = { id: number; title: string; slug: string }
export type DirectoryPerson = {
  id: string
  fullName: string
  profilePhoto: string | null
  jobTitle: string | null
  companyName: string | null
  companyLogo: string | null
  linkedinUrl: string | null
  showLinkedin: boolean
  showCompanyLogo: boolean
  roleTypes: string[]
  featured: boolean
  sortOrder: number
  organizationId: number | null
  organizationName: string | null
  createdAt: string
  updatedAt: string
  events: PersonConnection[]
  programs: PersonConnection[]
}

function pushUnique(list: PersonConnection[], conn: PersonConnection) {
  if (!list.some((c) => c.id === conn.id)) list.push(conn)
}

/**
 * Public people directory. The central `people` table is the single source of truth —
 * team members and event speakers are synced into it (see lib/people-sync). Each person is
 * returned with the events and programs they are connected to, ordered by the global
 * sortOrder (Team → Government → Ecosystem/Investor → Startup Founder → rest).
 */
export async function getPeopleDirectory(): Promise<DirectoryPerson[]> {
  return withDb(async () => {
    const peopleRows = await db
      .select({ person: people, organizationName: organizations.name })
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.organizationId))
      .where(eq(people.status, "published"))
      .orderBy(asc(people.sortOrder), asc(people.id))
    if (peopleRows.length === 0) return []

    const byPersonId = new Map<number, DirectoryPerson>()
    const result: DirectoryPerson[] = peopleRows.map(({ person: p, organizationName }) => {
      const entry: DirectoryPerson = {
        id: `person-${p.id}`,
        fullName: p.fullName,
        profilePhoto: resolveOptionalImage(p.profilePhoto),
        jobTitle: p.jobTitle,
        companyName: p.companyName,
        companyLogo: resolveOptionalImage(p.companyLogo),
        linkedinUrl: p.linkedinUrl,
        showLinkedin: p.showLinkedin,
        showCompanyLogo: p.showCompanyLogo,
        roleTypes: [...(p.roleTypes ?? [])],
        featured: p.featured,
        sortOrder: p.sortOrder,
        organizationId: p.organizationId ?? null,
        organizationName: organizationName ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        events: [],
        programs: [],
      }
      byPersonId.set(p.id, entry)
      return entry
    })

    const ids = peopleRows.map((r) => r.person.id)
    const [eventLinks, programLinks] = await Promise.all([
      db
        .select({ personId: eventsPeople.personId, id: events.id, title: events.title, slug: events.slug })
        .from(eventsPeople)
        .innerJoin(events, eq(events.id, eventsPeople.eventId))
        .where(inArray(eventsPeople.personId, ids))
        .orderBy(asc(eventsPeople.sortOrder)),
      db
        .select({ personId: programsPeople.personId, id: programs.id, title: programs.title, slug: programs.slug })
        .from(programsPeople)
        .innerJoin(programs, eq(programs.id, programsPeople.programId))
        .where(inArray(programsPeople.personId, ids))
        .orderBy(asc(programsPeople.sortOrder)),
    ])
    for (const l of eventLinks) {
      const entry = byPersonId.get(l.personId)
      if (entry) pushUnique(entry.events, { id: l.id, title: l.title, slug: l.slug })
    }
    for (const l of programLinks) {
      const entry = byPersonId.get(l.personId)
      if (entry) pushUnique(entry.programs, { id: l.id, title: l.title, slug: l.slug })
    }

    return result
  }, [])
}

export async function getPeopleForEvent(eventId: number): Promise<Person[]> {
  return withDb(async () => {
    const links = await db
      .select()
      .from(eventsPeople)
      .where(eq(eventsPeople.eventId, eventId))
      .orderBy(asc(eventsPeople.sortOrder))
    const ids = links.map((l) => l.personId)
    if (ids.length === 0) return []
    const rows = await db
      .select()
      .from(people)
      .where(and(inArray(people.id, ids), eq(people.status, "published")))
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(resolvePersonRecord)
  }, [])
}

export async function getPeopleForProgram(programId: number): Promise<Person[]> {
  return withDb(async () => {
    const links = await db
      .select()
      .from(programsPeople)
      .where(eq(programsPeople.programId, programId))
      .orderBy(asc(programsPeople.sortOrder))
    const ids = links.map((l) => l.personId)
    if (ids.length === 0) return []
    const rows = await db
      .select()
      .from(people)
      .where(and(inArray(people.id, ids), eq(people.status, "published")))
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(resolvePersonRecord)
  }, [])
}

// ---- Import & ordering ----

/**
 * Idempotent import that pulls every legacy "person" surface into the central `people`
 * table: team members and free-text event speakers. People are deduplicated by name (via
 * findOrCreatePersonByName), event connections are (re)built, and the whole table is
 * renumbered to the global order (Team → Government → Ecosystem/Investor → Startup → rest).
 */
export async function importPeopleFromSources() {
  await getUserId()
  const before = await db.select({ id: people.id }).from(people)
  const beforeCount = before.length

  const [teamRows, eventRows] = await Promise.all([
    db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder), asc(teamMembers.id)),
    db.select().from(events).orderBy(asc(events.eventDate)),
  ])

  // 1) Team members → people (explicit "Team" role)
  for (const t of teamRows) {
    if (!t.name?.trim()) continue
    await findOrCreatePersonByName({
      fullName: t.name,
      jobTitle: t.role,
      companyName: t.company,
      profilePhoto: t.imageUrl,
      linkedinUrl: t.linkedinUrl,
      roleTypes: ["Team"],
    })
  }

  // 2) Event speakers → people + rebuilt event connections (preserves any picked people)
  for (const e of eventRows) {
    const existingLinks = await db
      .select({ personId: eventsPeople.personId })
      .from(eventsPeople)
      .where(eq(eventsPeople.eventId, e.id))
    await syncEventSpeakerPeople(
      e.id,
      e.speakers ?? [],
      existingLinks.map((l) => l.personId),
    )
  }

  await renumberPeopleByPriority()
  const total = (await db.select({ id: people.id }).from(people)).length

  revalidatePath("/")
  revalidatePath("/team")
  return { imported: total - beforeCount, total }
}

/** Move a person up or down one position in the global ordering. */
export async function reorderPerson(id: number, direction: "up" | "down") {
  await getUserId()
  const all = await db.select().from(people).orderBy(asc(people.sortOrder), asc(people.id))
  const idx = all.findIndex((p) => p.id === id)
  if (idx === -1) return
  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  ;[all[idx], all[swapIdx]] = [all[swapIdx], all[idx]]
  for (let i = 0; i < all.length; i++) {
    if (all[i].sortOrder !== i) {
      await db.update(people).set({ sortOrder: i }).where(eq(people.id, all[i].id))
    }
  }
  revalidatePath("/")
  revalidatePath("/team")
}

// ---- Admin reads ----

export async function getMyPeople(): Promise<PersonWithOrg[]> {
  await getUserId()
  const rows = await db
    .select({ person: people, organizationName: organizations.name })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.organizationId))
    .orderBy(asc(people.sortOrder), asc(people.id))
  return rows.map((r) => ({ ...r.person, organizationName: r.organizationName ?? null }))
}

/** Lightweight list of organizations for the "assign to organisation" dropdown in People admin. */
export async function getOrganizationOptions(): Promise<{ id: number; name: string }[]> {
  await getUserId()
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .orderBy(asc(organizations.name))
}

export async function getPeopleCounts() {
  await getUserId()
  return withDb(
    async () => {
      const rows = await db.select().from(people)
      const counts = { total: rows.length, published: 0, draft: 0, homepage: 0 }
      const byRole: Record<string, number> = {}
      for (const r of rows) {
        if (r.status === "published") counts.published++
        else counts.draft++
        if (r.showOnHomepage) counts.homepage++
        for (const role of r.roleTypes ?? []) byRole[role] = (byRole[role] ?? 0) + 1
      }
      return { counts, byRole }
    },
    { counts: { total: 0, published: 0, draft: 0, homepage: 0 }, byRole: {} as Record<string, number> },
  )
}

// ---- Admin writes ----

function normalize(input: PersonInput) {
  return {
    fullName: input.fullName,
    profilePhoto: input.profilePhoto || null,
    jobTitle: input.jobTitle || null,
    companyName: input.companyName || null,
    companyLogo: input.companyLogo || null,
    linkedinUrl: input.linkedinUrl || null,
    email: input.email || null,
    country: input.country || null,
    bio: input.bio || null,
    organizationId: input.organizationId ?? null,
    roleTypes: input.roleTypes ?? [],
    tags: input.tags ?? [],
    featured: input.featured ?? false,
    status: input.status || "published",
    sortOrder: input.sortOrder ?? 0,
    showOnHomepage: input.showOnHomepage ?? false,
    showCompanyLogo: input.showCompanyLogo ?? true,
    showLinkedin: input.showLinkedin ?? true,
    showRoleBadge: input.showRoleBadge ?? false,
  }
}

export async function createPerson(input: PersonInput) {
  const userId = await getUserId()
  await db.insert(people).values({ ...normalize(input), authorId: userId })
  revalidatePath("/")
  revalidatePath("/team")
}

export async function updatePerson(id: number, input: PersonInput) {
  await getUserId()
  await db
    .update(people)
    .set({ ...normalize(input), updatedAt: new Date() })
    .where(eq(people.id, id))
  revalidatePath("/")
  revalidatePath("/team")
}

export async function deletePerson(id: number) {
  await getUserId()
  await db.delete(people).where(eq(people.id, id))
  await db.delete(eventsPeople).where(eq(eventsPeople.personId, id))
  await db.delete(programsPeople).where(eq(programsPeople.personId, id))
  revalidatePath("/")
  revalidatePath("/team")
}

// ---- Connections: events ----

export type ConnectedPerson = Person & { roleAtContext: string | null }

export async function getEventPeople(eventId: number): Promise<ConnectedPerson[]> {
  return withDb(async () => {
    const rows = await db
      .select({ person: people, link: eventsPeople })
      .from(eventsPeople)
      .innerJoin(people, eq(people.id, eventsPeople.personId))
      .where(and(eq(eventsPeople.eventId, eventId), eq(people.status, "published")))
      .orderBy(asc(eventsPeople.sortOrder), asc(eventsPeople.id))
    return rows.map((r) => ({ ...r.person, roleAtContext: r.link.roleAtEvent }))
  }, [])
}

export async function setEventPeople(eventId: number, personIds: number[]) {
  await getUserId()
  await db.delete(eventsPeople).where(eq(eventsPeople.eventId, eventId))
  if (personIds.length > 0) {
    await db.insert(eventsPeople).values(
      personIds.map((personId, i) => ({ eventId, personId, sortOrder: i })),
    )
  }
  revalidatePath("/")
}

// ---- Connections: programs ----

export async function getProgramPeople(programId: number): Promise<ConnectedPerson[]> {
  return withDb(async () => {
    const rows = await db
      .select({ person: people, link: programsPeople })
      .from(programsPeople)
      .innerJoin(people, eq(people.id, programsPeople.personId))
      .where(and(eq(programsPeople.programId, programId), eq(people.status, "published")))
      .orderBy(asc(programsPeople.sortOrder), asc(programsPeople.id))
    return rows.map((r) => ({ ...r.person, roleAtContext: r.link.roleAtProgram }))
  }, [])
}

export async function setProgramPeople(programId: number, personIds: number[]) {
  await getUserId()
  await db.delete(programsPeople).where(eq(programsPeople.programId, programId))
  if (personIds.length > 0) {
    await db.insert(programsPeople).values(
      personIds.map((personId, i) => ({ programId, personId, sortOrder: i })),
    )
  }
  revalidatePath("/")
}

// Map of personId -> connection counts (for admin display)
export async function getPersonConnectionCounts(personIds: number[]) {
  await getUserId()
  if (personIds.length === 0) return {} as Record<number, { events: number; programs: number }>
  return withDb(async () => {
    const ev = await db
      .select({ personId: eventsPeople.personId, c: sql<number>`count(*)::int` })
      .from(eventsPeople)
      .where(inArray(eventsPeople.personId, personIds))
      .groupBy(eventsPeople.personId)
    const pr = await db
      .select({ personId: programsPeople.personId, c: sql<number>`count(*)::int` })
      .from(programsPeople)
      .where(inArray(programsPeople.personId, personIds))
      .groupBy(programsPeople.personId)
    const out: Record<number, { events: number; programs: number }> = {}
    for (const id of personIds) out[id] = { events: 0, programs: 0 }
    for (const r of ev) out[r.personId].events = r.c
    for (const r of pr) out[r.personId].programs = r.c
    return out
  }, {} as Record<number, { events: number; programs: number }>)
}
