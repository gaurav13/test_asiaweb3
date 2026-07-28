import { pgTable, text, timestamp, boolean, serial, integer, date, jsonb } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  role: text("role").notNull().default("admin"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  impersonatedBy: text("impersonatedBy"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
})

export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content"),
  category: text("category").notNull().default("News"),
  imageUrl: text("image_url"),
  location: text("location"),
  // Unified newsroom fields (media coverage is now part of the newsroom)
  externalUrl: text("external_url"),
  source: text("source"),
  status: text("status").notNull().default("published"),
  isFeatured: boolean("is_featured").notNull().default(false),
  programId: integer("program_id"),
  mediaType: text("media_type").notNull().default("article"),
  sortOrder: integer("sort_order").notNull().default(0),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  eventDate: date("event_date").notNull(),
  timeLabel: text("time_label"),
  location: text("location"),
  venue: text("venue"),
  imageUrl: text("image_url"),
  bannerUrl: text("banner_url"),
  joinUrl: text("join_url"),
  joinLabel: text("join_label"),
  secondaryUrl: text("secondary_url"),
  secondaryLabel: text("secondary_label"),
  highlights: jsonb("highlights").$type<EventHighlight[]>().notNull().default([]),
  agenda: jsonb("agenda").$type<EventAgendaItem[]>().notNull().default([]),
  sponsors: jsonb("sponsors").$type<EventSponsor[]>().notNull().default([]),
  speakers: jsonb("speakers").$type<EventSpeaker[]>().notNull().default([]),
  isFeatured: boolean("is_featured").notNull().default(false),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export type EventSponsor = { name: string; logoUrl?: string; linkUrl?: string; tier?: string }
export type EventSpeaker = {
  name: string
  badge?: string
  role?: string
  company?: string
  companyLogoUrl?: string
  imageUrl?: string
  linkUrl?: string
}
export type EventHighlight = { title: string; description?: string; icon?: string }
export type EventAgendaItem = { time?: string; title: string; description?: string }

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  icon: text("icon").notNull().default("Rocket"),
  regions: text("regions"),
  imageUrl: text("image_url"),
  bannerUrl: text("banner_url"),
  partners: jsonb("partners").$type<ProgramPartner[]>().notNull().default([]),
  startups: jsonb("startups").$type<ProgramStartup[]>().notNull().default([]),
  gallery: jsonb("gallery").$type<GalleryItem[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export type ProgramPartner = { name: string; logoUrl?: string; linkUrl?: string }
export type ProgramStartup = { name: string; logoUrl?: string; description?: string; linkUrl?: string }
export type GalleryItem = { imageUrl: string; caption?: string }

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("Article"),
  url: text("url"),
  thumbnailUrl: text("thumbnail_url"),
  logoUrl: text("logo_url"),
  source: text("source"),
  excerpt: text("excerpt"),
  programId: integer("program_id").references(() => programs.id, { onDelete: "set null" }),
  isFeatured: boolean("is_featured").notNull().default(false),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const galleries = pgTable("galleries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Event"),
  coverImageUrl: text("cover_image_url"),
  photos: jsonb("photos").$type<GalleryItem[]>().notNull().default([]),
  eventDate: date("event_date"),
  location: text("location"),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title"),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  company: text("company"),
  bio: text("bio"),
  imageUrl: text("image_url"),
  linkedinUrl: text("linkedin_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("strategic"),
  logoUrl: text("logo_url"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  founderName: text("founder_name"),
  designation: text("designation"),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  description: text("description"),
  category: text("category").notNull().default("corporate"),
  contactEmail: text("contact_email"),
  contactUrl: text("contact_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const membershipPlans = pgTable("membership_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("Users"),
  price: text("price").notNull().default("Free"),
  priceNote: text("price_note"),
  periodLabel: text("period_label").default("1 Year Membership"),
  badge: text("badge"),
  description: text("description").notNull().default(""),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  ctaLabel: text("cta_label").notNull().default("Join Now"),
  ctaUrl: text("cta_url"),
  footnote: text("footnote"),
  accent: text("accent").notNull().default("gold"),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  profilePhoto: text("profile_photo"),
  jobTitle: text("job_title"),
  // One-to-many link to the central Organizations directory. A person belongs to at most one
  // organization; an organization can have many people. The FK (ON DELETE SET NULL) and the
  // unique constraints are enforced at the DB level via lib/db/ensure-schema.ts.
  organizationId: integer("organization_id"),
  companyName: text("company_name"),
  companyLogo: text("company_logo"),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  country: text("country"),
  bio: text("bio"),
  roleTypes: jsonb("role_types").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  status: text("status").notNull().default("published"),
  sortOrder: integer("sort_order").notNull().default(0),
  showOnHomepage: boolean("show_on_homepage").notNull().default(false),
  showCompanyLogo: boolean("show_company_logo").notNull().default(true),
  showLinkedin: boolean("show_linkedin").notNull().default(true),
  showRoleBadge: boolean("show_role_badge").notNull().default(false),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const eventsPeople = pgTable("events_people", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  personId: integer("person_id").notNull(),
  roleAtEvent: text("role_at_event"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const programsPeople = pgTable("programs_people", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull(),
  personId: integer("person_id").notNull(),
  roleAtProgram: text("role_at_program"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ---- Central Organizations directory ----
// Single source of truth for every organization (Members, Partners, Startups, Sponsors,
// Government, VCs, Media). Events and Programs link to it via the junction tables below.
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Primary type — used for default sorting/grouping.
  type: text("type").notNull().default("Member"),
  // Display + filter tags (e.g. "Corporate Member", "Sponsor", "Media Partner"). A single
  // company can carry several tags so it appears once with all its relationships.
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  country: text("country"),
  industry: text("industry"),
  description: text("description"),
  // approved (public) | pending (awaiting review) | hidden (kept but not shown)
  status: text("status").notNull().default("approved"),
  featured: boolean("featured").notNull().default(false),
  // Controls whether this company is eligible for the homepage "New Members" slider.
  // Defaults to true so approved companies appear until an admin disables them.
  showOnHomepage: boolean("show_on_homepage").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
export type Organization = typeof organizations.$inferSelect

export const eventsOrganizations = pgTable("events_organizations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  roleAtEvent: text("role_at_event"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const programsOrganizations = pgTable("programs_organizations", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  roleAtProgram: text("role_at_program"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const newsOrganizations = pgTable("news_organizations", {
  id: serial("id").primaryKey(),
  newsId: integer("news_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  roleAtNews: text("role_at_news"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ---- Public member applications ----
// Submissions from the public /membership/apply form. Reviewed in the admin dashboard;
// approving one creates/updates a central organization (de-duplicated by name).
export const memberApplications = pgTable("member_applications", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  applicantName: text("applicant_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  country: text("country"),
  // The membership category the applicant is applying for (a MEMBER_TAG).
  category: text("category").notNull().default("Corporate Member"),
  description: text("description"),
  logoUrl: text("logo_url"),
  reasonForJoining: text("reason_for_joining"),
  linkedinUrl: text("linkedin_url"),
  message: text("message"),
  founderName: text("founder_name"),
  founderPhoto: text("founder_photo"),
  founderEmail: text("founder_email"),
  // pending | approved | rejected | info_requested
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  organizationId: integer("organization_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
export type MemberApplication = typeof memberApplications.$inferSelect

export const ORGANIZATION_TYPES = [
  "Member",
  "Partner",
  "Startup",
  "Sponsor",
  "Government",
  "VC",
  "Media",
] as const
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

// Multi-tag values live in lib/organization-types.ts (client-safe) as MEMBER_TAGS.

export const APPLICATION_STATUSES = ["pending", "approved", "rejected", "info_requested"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const ORGANIZATION_STATUSES = ["approved", "pending", "hidden"] as const
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number]

export const PEOPLE_ROLE_TYPES = [
  "Leadership",
  "Advisor",
  "Speaker",
  "Mentor",
  "Investor",
  "Ecosystem Partner",
  "Government",
  "Startup Founder",
  "Team",
] as const
export type PeopleRoleType = (typeof PEOPLE_ROLE_TYPES)[number]

// ---- Advertising & newsletter system ----
// A single unified table for every promotional unit: in-flow banners
// (top/mid/sidebar/bottom/in-content), the popup ad, the right-side floating ad,
// the mobile bottom sticky, and the newsletter popup. They all share scheduling,
// page targeting, status, and impression/click tracking.
export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  campaignName: text("campaign_name").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  altText: text("alt_text"),
  // Popup / floating / newsletter copy
  title: text("title"),
  bodyText: text("body_text"),
  buttonText: text("button_text"),
  // home | events | programs | news | partners | members | all
  pageTarget: text("page_target").notNull().default("all"),
  // top | mid | sidebar | bottom | in-content | popup | sticky-header |
  // floating | floating-mobile | mobile-sticky | newsletter
  placement: text("placement").notNull().default("top"),
  // immediate | delay | scroll | exit  (overlays only)
  trigger: text("trigger").notNull().default("delay"),
  // session | day | always  (overlays only)
  frequency: text("frequency").notNull().default("session"),
  // active | hidden
  status: text("status").notNull().default("active"),
  // Whether to display the small "Sponsored" label on the ad unit.
  showSponsoredLabel: boolean("show_sponsored_label").notNull().default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
export type Ad = typeof ads.$inferSelect

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  consent: boolean("consent").notNull().default(true),
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect

export const AD_PAGE_TARGETS = ["all", "home", "events", "programs", "news", "partners", "members"] as const
export type AdPageTarget = (typeof AD_PAGE_TARGETS)[number]

export const AD_PLACEMENTS = [
  "top",
  "mid",
  "sidebar",
  "bottom",
  "in-content",
  "popup",
  "sticky-header",
  "floating",
  "floating-mobile",
  "mobile-sticky",
  "newsletter",
] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]

/** Placements that render as fixed/overlay units (handled client-side with triggers). */
export const AD_OVERLAY_PLACEMENTS = [
  "popup",
  "sticky-header",
  "floating",
  "floating-mobile",
  "mobile-sticky",
  "newsletter",
] as const

export const AD_TRIGGERS = ["immediate", "delay", "scroll", "exit"] as const
export type AdTrigger = (typeof AD_TRIGGERS)[number]

export const AD_FREQUENCIES = ["session", "day", "always"] as const
export type AdFrequency = (typeof AD_FREQUENCIES)[number]

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  organization: text("organization"),
  inquiryType: text("inquiry_type").notNull().default("Other"),
  subject: text("subject"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
