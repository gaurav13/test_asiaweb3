"use server"

import { db } from "@/lib/db"
import { withDb } from "@/lib/db/with-db"
import { memberApplications, organizations, people, type MemberApplication } from "@/lib/db/schema"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserId } from "@/lib/admin-helpers"
import { resolveOptionalImage, toStoredImagePath } from "@/lib/images"
import { ensureRelationalSchema } from "@/lib/db/ensure-schema"
import { findOrCreateOrganizationByName } from "@/lib/organizations-sync"
import { findOrCreatePersonByName } from "@/lib/people-sync"
import { MEMBER_TAGS, tagFromApplicationCategory, type ApplicationStatus } from "@/lib/organization-types"

/** Author id stamped on records created by unauthenticated public submissions. */
const SYSTEM_AUTHOR = "public-application"

/** Map a membership tag onto the organization's primary type. */
function orgTypeForTag(tag: string): string {
  if (tag.includes("Startup")) return "Startup"
  if (tag.includes("Media")) return "Media"
  if (tag.includes("Government")) return "Government"
  if (tag.includes("Sponsor")) return "Sponsor"
  return "Member"
}

/**
 * Create/refresh the central Organization and its People (applicant + optional founder) for an
 * application, establishing the one-to-many link. On submit we create them as pending/draft so
 * they show in the admin immediately; on approval we promote everything to approved/published.
 * De-duplicates organizations by name and people by email.
 */
async function syncApplicationToDirectory(
  app: MemberApplication,
  { publish }: { publish: boolean },
): Promise<number> {
  await ensureRelationalSchema()

  const tag = tagFromApplicationCategory(app.category)

  const { id: orgId, duplicate } = await findOrCreateOrganizationByName(
    {
      name: app.companyName,
      type: orgTypeForTag(tag),
      tags: [tag],
      logoUrl: app.logoUrl,
      websiteUrl: app.website,
      country: app.country,
      description: app.description,
      status: publish ? "approved" : "pending",
    },
    { authorId: SYSTEM_AUTHOR },
  )

  // Existing company: merge the new tag + backfill empty fields without overwriting. Never
  // downgrade an already-approved org; only promote to approved when publishing.
  if (duplicate) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    if (org) {
      const nextTags = Array.from(new Set([...(org.tags ?? []), tag]))
      await db
        .update(organizations)
        .set({
          tags: nextTags,
          logoUrl: org.logoUrl ?? app.logoUrl,
          websiteUrl: org.websiteUrl ?? app.website,
          country: org.country ?? app.country,
          description: org.description ?? app.description,
          status: publish ? "approved" : org.status,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId))
    }
  }

  const personStatus = publish ? "published" : "draft"

  // Applicant / primary contact becomes a Person linked to the organization.
  await findOrCreatePersonByName(
    {
      fullName: app.applicantName,
      email: app.email,
      companyName: app.companyName,
      companyLogo: app.logoUrl,
      linkedinUrl: app.linkedinUrl,
      country: app.country,
      organizationId: orgId,
      status: personStatus,
      roleTypes: [],
    },
    { authorId: SYSTEM_AUTHOR },
  )

  // Founder / representative (optional) is a second member of the same organization.
  if (app.founderName?.trim()) {
    await findOrCreatePersonByName(
      {
        fullName: app.founderName,
        email: app.founderEmail,
        jobTitle: "Founder / Representative",
        companyName: app.companyName,
        companyLogo: app.logoUrl,
        profilePhoto: app.founderPhoto,
        country: app.country,
        organizationId: orgId,
        status: personStatus,
        roleTypes: ["Startup Founder"],
      },
      { authorId: SYSTEM_AUTHOR },
    )
  }

  // Publishing an org should take any of its still-drafted members live as well.
  if (publish) {
    await db
      .update(people)
      .set({ status: "published", updatedAt: new Date() })
      .where(and(eq(people.organizationId, orgId), eq(people.status, "draft")))
  }

  await db
    .update(memberApplications)
    .set({ organizationId: orgId, updatedAt: new Date() })
    .where(eq(memberApplications.id, app.id))

  return orgId
}

export type PublicApplicationInput = {
  companyName: string
  applicantName: string
  email: string
  phone?: string
  website?: string
  country?: string
  category?: string
  description?: string
  logoUrl?: string
  reasonForJoining?: string
  linkedinUrl?: string
  message?: string
  founderName?: string
  founderPhoto?: string
  founderEmail?: string
}

function clean(value?: string | null): string | null {
  const v = (value ?? "").trim()
  return v || null
}

function normalizeCategory(category?: string): string {
  const match = MEMBER_TAGS.find((t) => t.toLowerCase() === (category ?? "").trim().toLowerCase())
  return match ?? "Corporate Member"
}

// ---- Public write ----

/**
 * Public submission from /membership/apply. Stored as a pending application for admin review.
 * No authentication required. Approval later creates/updates a central organization.
 */
export async function createMemberApplication(
  input: PublicApplicationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const companyName = (input.companyName ?? "").trim()
  const applicantName = (input.applicantName ?? "").trim()
  const email = (input.email ?? "").trim()

  if (!companyName) return { ok: false, error: "Company name is required." }
  if (!applicantName) return { ok: false, error: "Your name is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email address is required." }

  try {
    const [app] = await db
      .insert(memberApplications)
      .values({
        companyName,
        applicantName,
        email,
        phone: clean(input.phone),
        website: clean(input.website),
        country: clean(input.country),
        category: normalizeCategory(input.category),
        description: clean(input.description),
        logoUrl: input.logoUrl ? toStoredImagePath(input.logoUrl) : null,
        reasonForJoining: clean(input.reasonForJoining),
        linkedinUrl: clean(input.linkedinUrl),
        message: clean(input.message),
        founderName: clean(input.founderName),
        founderPhoto: input.founderPhoto ? toStoredImagePath(input.founderPhoto) : null,
        founderEmail: clean(input.founderEmail),
        status: "pending",
      })
      .returning()

    // Immediately create/link the central Organization and People records (pending/draft) so
    // the submission appears in Admin → People and Admin → Organizations right away. This is
    // best-effort: a failure here must not lose the applicant's submission.
    try {
      await syncApplicationToDirectory(app, { publish: false })
    } catch (syncErr) {
      console.error("[member-applications] directory sync failed:", syncErr)
    }

    revalidatePath("/membership/apply")
    revalidatePath("/admin")
    return { ok: true }
  } catch (err) {
    console.error("[member-applications] create failed:", err)
    return { ok: false, error: "Something went wrong submitting your application. Please try again." }
  }
}

// ---- Admin reads ----

function resolveApplication(row: MemberApplication): MemberApplication {
  return {
    ...row,
    logoUrl: resolveOptionalImage(row.logoUrl),
    founderPhoto: resolveOptionalImage(row.founderPhoto),
  }
}

export async function getMyApplications(): Promise<MemberApplication[]> {
  await getUserId()
  return withDb(async () => {
    const rows = await db
      .select()
      .from(memberApplications)
      .orderBy(desc(memberApplications.createdAt), asc(memberApplications.id))
    return rows.map(resolveApplication)
  }, [])
}

export async function getApplicationCounts() {
  await getUserId()
  return withDb(
    async () => {
      const rows = await db.select({ status: memberApplications.status, isRead: memberApplications.isRead }).from(
        memberApplications,
      )
      const counts = { total: rows.length, pending: 0, approved: 0, rejected: 0, info_requested: 0, unread: 0 }
      for (const r of rows) {
        if (r.status in counts) (counts as Record<string, number>)[r.status]++
        if (!r.isRead) counts.unread++
      }
      return counts
    },
    { total: 0, pending: 0, approved: 0, rejected: 0, info_requested: 0, unread: 0 },
  )
}

// ---- Admin writes ----

export async function markApplicationRead(id: number) {
  await getUserId()
  await db.update(memberApplications).set({ isRead: true }).where(eq(memberApplications.id, id))
  revalidatePath("/admin")
}

export async function setApplicationStatus(id: number, status: ApplicationStatus, reviewNotes?: string) {
  await getUserId()
  await db
    .update(memberApplications)
    .set({ status, reviewNotes: reviewNotes?.trim() || null, isRead: true, updatedAt: new Date() })
    .where(eq(memberApplications.id, id))
  revalidatePath("/admin")
}

/**
 * Approve an application: create (or reuse) the central organization, de-duplicated by name.
 * If the company already exists, its category tag is merged in (never duplicating the company).
 * Links the application to the resulting organization.
 */
export async function approveApplication(id: number): Promise<{ ok: true; organizationId: number } | { ok: false; error: string }> {
  await getUserId()
  try {
    const [app] = await db.select().from(memberApplications).where(eq(memberApplications.id, id)).limit(1)
    if (!app) return { ok: false, error: "Application not found." }

    // Create/reuse the organization + its people and promote everything to approved/published.
    const orgId = await syncApplicationToDirectory(app, { publish: true })

    await db
      .update(memberApplications)
      .set({ status: "approved", organizationId: orgId, isRead: true, updatedAt: new Date() })
      .where(eq(memberApplications.id, id))

    revalidatePath("/admin")
    revalidatePath("/members")
    revalidatePath("/team")
    revalidatePath("/")
    return { ok: true, organizationId: orgId }
  } catch (err) {
    console.error("[member-applications] approve failed:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to approve application." }
  }
}

export async function deleteApplication(id: number) {
  await getUserId()
  await db.delete(memberApplications).where(eq(memberApplications.id, id))
  revalidatePath("/admin")
}
