import type { Organization } from "@/lib/db/schema"

export type { Organization }

/**
 * Multi-tag values a company can carry. A single company appears once in the directory
 * with all of its tags shown as chips, and visitors can filter by any tag. Defined here
 * (not in the Drizzle schema) so client components can import it without pulling in the ORM.
 */
export const MEMBER_TAGS = [
  "Corporate Member",
  "Startup Member",
  "Media Partner",
  "Government Support",
  "Sponsor",
  "Event Partner",
  "Exclusive Member",
] as const
export type MemberTag = (typeof MEMBER_TAGS)[number]

/** Roles a company can play on a linked news post / event / program. */
export const ORG_LINK_ROLES = ["Sponsor", "Partner", "Media Partner", "Supporter", "Host", "Exhibitor"] as const

/** Lifecycle of a public membership application. */
export const APPLICATION_STATUSES = ["pending", "approved", "rejected", "info_requested"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  info_requested: "Info requested",
}

/** Best-effort mapping from a legacy organization `type` to a display tag. */
export function defaultTagForType(type: string | null | undefined): MemberTag {
  switch ((type || "").toLowerCase()) {
    case "startup":
      return "Startup Member"
    case "media":
      return "Media Partner"
    case "government":
      return "Government Support"
    case "sponsor":
      return "Sponsor"
    case "partner":
      return "Event Partner"
    default:
      return "Corporate Member"
  }
}

/** Map a public application category onto a tag (they share the same vocabulary). */
export function tagFromApplicationCategory(category: string | null | undefined): MemberTag {
  const match = MEMBER_TAGS.find((t) => t.toLowerCase() === (category || "").trim().toLowerCase())
  return match ?? "Corporate Member"
}

export type OrgConnection = { id: number; title: string; slug: string }

export type DirectoryOrganization = Organization & {
  events: OrgConnection[]
  programs: OrgConnection[]
}

/** A single person linked to an organization (for the admin org → members list). */
export type OrgMember = {
  id: number
  fullName: string
  jobTitle: string | null
  profilePhoto: string | null
  status: string
}

export type AdminOrganization = Organization & {
  eventCount: number
  programCount: number
  memberCount: number
  members: OrgMember[]
  events: OrgConnection[]
  programs: OrgConnection[]
}

export type EventProgramOptions = {
  events: { id: number; title: string }[]
  programs: { id: number; title: string }[]
}

export type OrganizationInput = {
  name: string
  type?: string
  tags?: string[]
  logoUrl?: string
  websiteUrl?: string
  country?: string
  industry?: string
  description?: string
  status?: string
  featured?: boolean
  showOnHomepage?: boolean
  sortOrder?: number
}
