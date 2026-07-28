"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Logo } from "@/components/awaj/logo"
import { authClient } from "@/lib/auth-client"
import { formatLongDate } from "@/lib/format-date"
import { ResourceManager, type FieldDef } from "./resource-manager"
import { SettingsPanel } from "./settings-panel"
import { MessagesPanel } from "./messages-panel"
import { UserManager, type AdminUser } from "./user-manager"
import { createNews, updateNews, deleteNews } from "@/app/actions/news"
import { createEvent, updateEvent, deleteEvent } from "@/app/actions/events"
import { createProgram, updateProgram, deleteProgram } from "@/app/actions/programs"
import { createTeamMember, updateTeamMember, deleteTeamMember } from "@/app/actions/team"
import { createPartner, updatePartner, deletePartner } from "@/app/actions/partners"
import { createMember, updateMember, deleteMember } from "@/app/actions/members"
import {
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
} from "@/app/actions/membership"
import { MembershipContentPanel } from "./membership-content-panel"
import type { MembershipContent } from "@/lib/membership-content"
import { PeoplePanel } from "./people-panel"
import type { PersonWithOrg } from "@/app/actions/people"
import { OrganizationsPanel } from "./organizations-panel"
import { ApplicationsPanel } from "./applications-panel"
import type { MemberApplication } from "@/lib/db/schema"
import { quickCreateOrganization } from "@/app/actions/organizations"
import type { AdminOrganization, EventProgramOptions } from "@/lib/organization-types"
import { AdsManager } from "./ads-manager"
import type { AdminAd } from "@/lib/ad-types"
import type { NewsletterSubscriber } from "@/lib/db/schema"
import { createBanner, updateBanner, deleteBanner } from "@/app/actions/banners"
import { createMedia, updateMedia, deleteMedia } from "@/app/actions/media"
import { createGallery, updateGallery, deleteGallery } from "@/app/actions/gallery"
import { MEMBER_CATEGORIES, memberCategoryLabel } from "@/lib/member-categories"
import type { SiteSettings } from "@/app/actions/settings"
import type {
  ProgramPartner,
  ProgramStartup,
  GalleryItem,
  EventSponsor,
  EventSpeaker,
  EventHighlight,
  EventAgendaItem,
} from "@/lib/db/schema"

type News = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string | null
  category: string
  imageUrl: string | null
  location: string | null
  publishedAt: Date | string
  organizationIds?: number[]
}
type Media = {
  id: number
  title: string
  type: string
  url: string | null
  thumbnailUrl: string | null
  logoUrl: string | null
  source: string | null
  excerpt: string | null
  programId: number | null
  isFeatured: boolean
  sortOrder: number
  publishedAt: Date | string
}
type Gallery = {
  id: number
  title: string
  description: string | null
  category: string
  coverImageUrl: string | null
  photos: GalleryItem[]
  eventDate: string | null
  location: string | null
  isFeatured: boolean
  sortOrder: number
}
type Event = {
  id: number
  title: string
  subtitle: string | null
  slug: string
  excerpt: string
  content: string
  eventDate: string
  timeLabel: string | null
  location: string | null
  venue: string | null
  imageUrl: string | null
  bannerUrl: string | null
  joinUrl: string | null
  joinLabel: string | null
  secondaryUrl: string | null
  secondaryLabel: string | null
  highlights: EventHighlight[]
  agenda: EventAgendaItem[]
  sponsors: EventSponsor[]
  speakers: EventSpeaker[]
  isFeatured: boolean
  peopleIds?: number[]
  organizationIds?: number[]
}
type Program = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  icon: string
  regions: string | null
  imageUrl: string | null
  bannerUrl: string | null
  partners: ProgramPartner[]
  startups: ProgramStartup[]
  gallery: GalleryItem[]
  sortOrder: number
  peopleIds?: number[]
  organizationIds?: number[]
}
type Team = {
  id: number
  name: string
  role: string
  company: string | null
  bio: string | null
  imageUrl: string | null
  linkedinUrl: string | null
  sortOrder: number
}
type Partner = {
  id: number
  name: string
  tier: string
  logoUrl: string | null
  linkUrl: string | null
  sortOrder: number
}
type Member = {
  id: number
  companyName: string
  founderName: string | null
  designation: string | null
  websiteUrl: string | null
  logoUrl: string | null
  description: string | null
  category: string
  contactEmail: string | null
  contactUrl: string | null
  sortOrder: number
}
type MembershipPlan = {
  id: number
  name: string
  icon: string
  price: string
  priceNote: string | null
  periodLabel: string | null
  badge: string | null
  description: string
  features: string[]
  ctaLabel: string
  ctaUrl: string | null
  footnote: string | null
  accent: string
  isHighlighted: boolean
  sortOrder: number
}
type Banner = {
  id: number
  title: string | null
  subtitle: string | null
  imageUrl: string
  linkUrl: string | null
  linkLabel: string | null
  isActive: boolean
  sortOrder: number
}
type Message = {
  id: number
  name: string
  email: string
  organization: string | null
  inquiryType: string
  subject: string | null
  message: string
  isRead: boolean
  createdAt: Date | string
}

const NEWS_CATEGORIES = ["News", "Partnerships", "Programs", "Events", "Announcements"]
const MEDIA_TYPES = ["Article", "Video", "Podcast", "Press Release", "Interview", "Report"]
const PROGRAM_ICONS = ["Rocket", "Building2", "Share2", "Globe", "GraduationCap", "Users", "Award", "Landmark"]
const GALLERY_CATEGORIES = ["Event", "Program", "Conference", "Workshop", "Meetup", "Award", "Other"]

const GALLERY_FIELDS: FieldDef[] = [
  { name: "title", label: "Activity / album title", type: "text", required: true, placeholder: "Japan Financial Innovation Program 2025" },
  { name: "category", label: "Category", type: "select", options: GALLERY_CATEGORIES },
  { name: "eventDate", label: "Date (optional)", type: "date", hint: "When this activity took place. Used for sorting and the album label." },
  { name: "location", label: "Location (optional)", type: "text", placeholder: "Tokyo, Japan" },
  {
    name: "description",
    label: "Short description (optional)",
    type: "textarea",
    rows: 3,
    placeholder: "A few words about this activity, shown under the album title.",
  },
  {
    name: "photos",
    label: "Photos",
    type: "gallery",
    hint: "Upload all the photos for this activity at once. Drag to reorder — the first photo becomes the album cover.",
  },
  { name: "isFeatured", label: "Feature this album on the homepage gallery", type: "checkbox" },
  { name: "sortOrder", label: "Sort order", type: "number" },
]

const EVENT_FIELDS: FieldDef[] = [
  // — Basics —
  { name: "title", label: "Title", type: "text", required: true, placeholder: "Japan Financial Innovation Program" },
  {
    name: "subtitle",
    label: "Subtitle (optional)",
    type: "text",
    placeholder: "Awards & Future of Finance Leadership Dialogue",
    hint: "Shown under the title in the hero.",
  },
  { name: "excerpt", label: "Short description", type: "textarea", required: true, rows: 3, placeholder: "One or two sentences shown in the hero and on cards." },

  // — When & where —
  { name: "eventDate", label: "Event date", type: "date", required: true },
  { name: "timeLabel", label: "Time", type: "text", placeholder: "12:00 – 16:30 (JST)" },
  { name: "venue", label: "Venue name (optional)", type: "text", placeholder: "Ark Mori Building, 7F" },
  { name: "location", label: "Address / location (optional)", type: "text", placeholder: "Akasaka, Minato-ku, Tokyo, Japan" },

  // — Call to action —
  {
    name: "joinUrl",
    label: "Primary button link (optional)",
    type: "text",
    placeholder: "https://lu.ma/your-event or a registration form URL",
    hint: "Paste any URL — a Luma/Eventbrite page, a Google Form, or your own form. Leave empty to hide the button.",
  },
  { name: "joinLabel", label: "Primary button text", type: "text", placeholder: "Register Now" },
  {
    name: "secondaryUrl",
    label: "Secondary button link (optional)",
    type: "text",
    placeholder: "https://... (e.g. a PDF agenda or info page)",
    hint: "An optional outline button next to the primary one. Leave empty to hide it.",
  },
  { name: "secondaryLabel", label: "Secondary button text", type: "text", placeholder: "View Agenda" },

  // — Images —
  { name: "imageUrl", label: "Poster / card image", type: "image", hint: "The square poster shown on the event page and on cards." },
  { name: "bannerUrl", label: "Detail page banner (optional)", type: "image", hint: "Overrides the poster on the event page only. Falls back to the poster if empty." },
  { name: "isFeatured", label: "Feature this event on the homepage", type: "checkbox" },

  // — About content —
  { name: "content", label: "About the event", type: "richtext", required: true },
  {
    name: "highlights",
    label: "Highlights",
    type: "repeater",
    addLabel: "Add highlight",
    hint: 'The small feature blocks under "About the Event" (e.g. Startup Pitches, Networking).',
    itemFields: [
      { name: "title", label: "Title", type: "text", placeholder: "Startup Pitches" },
      { name: "description", label: "Description (optional)", type: "textarea", placeholder: "Watch innovative startups pitch to investors." },
    ],
  },

  // — Agenda —
  {
    name: "agenda",
    label: "Agenda",
    type: "repeater",
    addLabel: "Add agenda item",
    hint: "Timeline of the day. Each row is one session.",
    itemFields: [
      { name: "time", label: "Time", type: "text", placeholder: "12:00 – 12:30" },
      { name: "title", label: "Session title", type: "text", placeholder: "Registration & Networking" },
      { name: "description", label: "Description (optional)", type: "textarea", placeholder: "Check-in and connect with industry leaders." },
    ],
  },

  // ��� Speakers —
  {
    name: "speakers",
    label: "Speakers",
    type: "repeater",
    addLabel: "Add speaker",
    hint: "Featured speakers shown on the event page.",
    itemFields: [
      { name: "name", label: "Name", type: "text", placeholder: "Takeshi Chino" },
      { name: "badge", label: "Badge (optional)", type: "text", placeholder: "Keynote / Panelist / Moderator" },
      { name: "role", label: "Role / title (optional)", type: "text", placeholder: "Global Head of Fintech" },
      { name: "company", label: "Company (optional)", type: "text", placeholder: "PwC Japan" },
      { name: "imageUrl", label: "Photo", type: "image" },
      { name: "companyLogoUrl", label: "Company logo (optional)", type: "image" },
      { name: "linkUrl", label: "Profile link (optional)", type: "text", placeholder: "https://..." },
    ],
  },

  // — Sponsors —
  {
    name: "sponsors",
    label: "Sponsors & partners",
    type: "repeater",
    addLabel: "Add sponsor",
    hint: "Logos shown in the sponsors section. Use the tier to group them (e.g. Diamond, Platinum, Gold).",
    itemFields: [
      { name: "name", label: "Name", type: "text", placeholder: "Ripple" },
      { name: "tier", label: "Tier (optional)", type: "text", placeholder: "Diamond / Platinum / Gold / Silver" },
      { name: "logoUrl", label: "Logo", type: "image" },
      { name: "linkUrl", label: "Website (optional)", type: "text", placeholder: "https://..." },
    ],
  },

  // — Connected people —
  {
    name: "peopleIds",
    label: "Connected people",
    type: "people",
    hint: "Link speakers, mentors, and leaders from the central People directory. Shown on the event page.",
  },

  // — Connected organizations —
  {
    name: "organizationIds",
    label: "Connected organizations",
    type: "organizations",
    hint: "Link sponsors, partners, and startups from the central Organizations directory. New ones are added to the directory and appear on the Members list automatically.",
  },
]

const PROGRAM_FIELDS: FieldDef[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "icon", label: "Icon", type: "select", options: PROGRAM_ICONS },
  { name: "regions", label: "Regions (optional)", type: "text", placeholder: "Japan • Singapore • USA • UAE" },
  { name: "imageUrl", label: "Card cover image", type: "image", hint: "Shown on the program cards (homepage & Programs page). Landscape works best." },
  { name: "bannerUrl", label: "Detail page banner", type: "image", hint: "Large image beside the title on the program's own page. Falls back to the card cover if empty." },
  { name: "sortOrder", label: "Sort order", type: "number" },
  { name: "excerpt", label: "Short summary", type: "textarea", required: true, rows: 3 },
  { name: "content", label: "Full description", type: "richtext", required: true },
  {
    name: "partners",
    label: "Program partners",
    type: "repeater",
    addLabel: "Add partner",
    hint: "Logos shown in the partner section of the program page.",
    itemFields: [
      { name: "name", label: "Name", type: "text", placeholder: "Microsoft" },
      { name: "logoUrl", label: "Logo", type: "image" },
      { name: "linkUrl", label: "Website (optional)", type: "text", placeholder: "https://..." },
    ],
  },
  {
    name: "startups",
    label: "Startups / cohort",
    type: "repeater",
    addLabel: "Add startup",
    hint: "Startups featured in this program.",
    itemFields: [
      { name: "name", label: "Name", type: "text", placeholder: "Startup name" },
      { name: "logoUrl", label: "Logo", type: "image" },
      { name: "description", label: "Description (optional)", type: "textarea", placeholder: "What they do" },
      { name: "linkUrl", label: "Website (optional)", type: "text", placeholder: "https://..." },
    ],
  },
  {
    name: "gallery",
    label: "Gallery",
    type: "repeater",
    addLabel: "Add photo",
    hint: "Photos shown in the program gallery.",
    itemFields: [
      { name: "imageUrl", label: "Image", type: "image" },
      { name: "caption", label: "Caption (optional)", type: "text", placeholder: "Demo Day 2025" },
    ],
  },
  {
    name: "peopleIds",
    label: "Connected people",
    type: "people",
    hint: "Link mentors, advisors, and leaders from the central People directory. Shown on the program page.",
  },
  {
    name: "organizationIds",
    label: "Connected organizations",
    type: "organizations",
    hint: "Link partners and startups from the central Organizations directory. New ones are added to the directory and appear on the Members list automatically.",
  },
]

const TEAM_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role / title", type: "text", required: true, placeholder: "Founder & CEO" },
  { name: "company", label: "Company (optional)", type: "text", placeholder: "Asia Web3 & AI Alliance" },
  { name: "imageUrl", label: "Photo", type: "image" },
  { name: "linkedinUrl", label: "LinkedIn URL (optional)", type: "text", placeholder: "https://linkedin.com/in/..." },
  { name: "sortOrder", label: "Sort order", type: "number" },
  { name: "bio", label: "Bio (optional)", type: "textarea", rows: 4 },
]

const PARTNER_TIERS = ["institution", "strategic"]

const PARTNER_FIELDS: FieldDef[] = [
  { name: "name", label: "Partner name", type: "text", required: true, placeholder: "Microsoft" },
  { name: "tier", label: "Tier", type: "select", options: PARTNER_TIERS },
  { name: "logoUrl", label: "Logo", type: "image" },
  { name: "linkUrl", label: "Website / link (optional)", type: "text", placeholder: "https://example.com" },
  { name: "sortOrder", label: "Sort order", type: "number" },
]

const MEMBER_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Company name", type: "text", required: true, placeholder: "Acme Inc." },
  {
    name: "category",
    label: "Membership category",
    type: "select",
    optionItems: MEMBER_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  },
  { name: "founderName", label: "Founder / representative (optional)", type: "text", placeholder: "Jane Doe" },
  { name: "designation", label: "Designation / title (optional)", type: "text", placeholder: "Founder & CEO" },
  { name: "websiteUrl", label: "Website link (optional)", type: "text", placeholder: "https://example.com" },
  {
    name: "contactUrl",
    label: "Custom contact link (optional)",
    type: "text",
    placeholder: "https://example.com/contact or a mailto: link",
    hint: 'The "Request to Contact" button opens this link directly. If left empty, the button opens the AWAJ contact form, pre-filled to request an introduction to this member.',
  },
  {
    name: "contactEmail",
    label: "Contact email (optional)",
    type: "text",
    placeholder: "contact@example.com",
    hint: "Used as the contact link if no custom link is set above. If both are empty, the AWAJ contact form is used instead.",
  },
  { name: "logoUrl", label: "Company logo (optional)", type: "image" },
  { name: "description", label: "Short description (optional)", type: "textarea", rows: 3 },
  { name: "sortOrder", label: "Sort order", type: "number" },
]

const MEMBERSHIP_ICONS = ["Users", "Rocket", "Building2", "Crown", "Globe", "Award", "Landmark", "Star"]

const MEMBERSHIP_FIELDS: FieldDef[] = [
  { name: "name", label: "Plan name", type: "text", required: true, placeholder: "Executive Member" },
  {
    name: "icon",
    label: "Icon",
    type: "select",
    options: MEMBERSHIP_ICONS,
    hint: "Shown in the circular badge at the top of the plan card.",
  },
  { name: "price", label: "Price", type: "text", required: true, placeholder: "Free or ¥600,000" },
  { name: "priceNote", label: "Price note (optional)", type: "text", placeholder: "per year" },
  { name: "periodLabel", label: "Period label (optional)", type: "text", placeholder: "1 Year Membership" },
  {
    name: "badge",
    label: "Corner badge (optional)",
    type: "text",
    placeholder: "Premium Access",
    hint: "Adds a ribbon badge to the top-right corner of the card.",
  },
  { name: "description", label: "Description", type: "textarea", rows: 3 },
  {
    name: "features",
    label: "Included features",
    type: "repeater",
    addLabel: "Add feature",
    hint: "Each feature shows with a check icon. Also used to build the comparison table.",
    itemFields: [{ name: "text", label: "Feature", type: "text", placeholder: "Access to member directory" }],
  },
  { name: "ctaLabel", label: "Button text", type: "text", required: true, placeholder: "Join as Supporter" },
  {
    name: "ctaUrl",
    label: "Button link (optional)",
    type: "text",
    placeholder: "/contact or https://...",
    hint: "Where the plan button sends the user. Defaults to the contact page if empty.",
  },
  { name: "footnote", label: "Footnote (optional)", type: "textarea", rows: 2 },
  {
    name: "accent",
    label: "Accent style",
    type: "select",
    optionItems: [
      { value: "gold", label: "Gold (standard)" },
      { value: "navy", label: "Navy (premium / highlighted)" },
    ],
  },
  { name: "isHighlighted", label: "Highlight this plan (dark premium card)", type: "checkbox" },
  { name: "sortOrder", label: "Sort order", type: "number" },
]

export function AdminDashboard({
  userName,
  currentUserId,
  isSuperAdmin,
  news,
  media,
  galleries,
  events,
  programs,
  team,
  partners,
  members,
  membershipPlans,
  membershipContent,
  people,
  peopleCounts,
  organizations,
  organizationCounts,
  eventProgramOptions,
  ads,
  subscribers,
  banners,
  messages,
  applications,
  settings,
  users,
}: {
  userName: string
  currentUserId: string
  isSuperAdmin: boolean
  news: News[]
  media: Media[]
  galleries: Gallery[]
  events: Event[]
  programs: Program[]
  team: Team[]
  partners: Partner[]
  members: Member[]
  membershipPlans: MembershipPlan[]
  membershipContent: MembershipContent
  people: PersonWithOrg[]
  peopleCounts: {
    counts: { total: number; published: number; draft: number; homepage: number }
    byRole: Record<string, number>
  }
  organizations: AdminOrganization[]
  organizationCounts: {
    counts: { total: number; approved: number; pending: number; hidden: number }
    byType: Record<string, number>
  }
  eventProgramOptions: EventProgramOptions
  ads: AdminAd[]
  subscribers: NewsletterSubscriber[]
  banners: Banner[]
  messages: Message[]
  applications: MemberApplication[]
  settings: SiteSettings
  users: AdminUser[]
}) {
  const router = useRouter()

  const programOptions = [
    { value: "none", label: "— None —" },
    ...programs.map((p) => ({ value: String(p.id), label: p.title })),
  ]

  const peopleOptions = people.map((p) => ({
    id: p.id,
    name: p.fullName,
    subtitle: [p.jobTitle, p.companyName].filter(Boolean).join(" · ") || undefined,
  }))

  const organizationOptions = organizations.map((o) => ({
    id: o.id,
    name: o.name,
    subtitle: [o.type, o.country].filter(Boolean).join(" · ") || undefined,
  }))

  const NEWS_FIELDS: FieldDef[] = [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "category", label: "Category", type: "select", options: NEWS_CATEGORIES },
    { name: "publishedAt", label: "Publish date", type: "date" },
    { name: "location", label: "Location (optional)", type: "text", placeholder: "Tokyo, Japan" },
    {
      name: "imageUrl",
      label: "Cover image",
      type: "image",
      hint: "Recommended 1200×675px (16:9), JPG or PNG, under 500KB.",
    },
    { name: "excerpt", label: "Excerpt", type: "textarea", required: true, rows: 2 },
    { name: "content", label: "Article content", type: "richtext", required: true },
    {
      name: "organizationIds",
      label: "Featured companies",
      type: "organizations",
      hint: "Link companies mentioned in this article (sponsors, partners, media). They stay in sync with the central directory — re-adding an existing company never creates a duplicate.",
    },
  ]

  const MEDIA_FIELDS: FieldDef[] = [
    { name: "title", label: "Title", type: "text", required: true, placeholder: "AWAJ featured in Nikkei" },
    {
      name: "type",
      label: "Format",
      type: "select",
      options: MEDIA_TYPES,
      hint: "Video / Podcast / Interview show a play badge in the homepage carousel.",
    },
    {
      name: "source",
      label: "Source / publisher",
      type: "text",
      placeholder: "Nikkei, CoinDesk, Bloomberg...",
      hint: "Shown prominently on the media card. The outlet name appears first.",
    },
    {
      name: "logoUrl",
      label: "Publisher logo",
      type: "image",
      hint: "The media outlet's logo, shown first on the card. Square or wide logo, transparent PNG preferred, under 200KB.",
    },
    {
      name: "url",
      label: "Link",
      type: "text",
      placeholder: "https://...",
      hint: "The article / video URL. Opens in a new tab when clicked.",
    },
    {
      name: "thumbnailUrl",
      label: "Banner / cover image",
      type: "image",
      hint: "Recommended 1200×675px (16:9), JPG or PNG, under 500KB.",
    },
    {
      name: "programId",
      label: "Related program (optional)",
      type: "select",
      optionItems: programOptions,
    },
    { name: "publishedAt", label: "Publish date", type: "date" },
    {
      name: "isFeatured",
      label: 'Feature in the homepage "AWAJ in the Media" carousel',
      type: "checkbox",
    },
    { name: "sortOrder", label: "Sort order", type: "number" },
    { name: "excerpt", label: "Short description (optional)", type: "textarea", rows: 2 },
  ]

  const BANNER_FIELDS: FieldDef[] = [
    {
      name: "imageUrl",
      label: "Banner image",
      type: "image",
      required: true,
      hint: "Recommended 1920×800px (wide), JPG or PNG, under 800KB. Shown full-width in the homepage slider.",
    },
    { name: "title", label: "Headline (optional)", type: "text", placeholder: "Shown over the banner" },
    { name: "subtitle", label: "Subtitle (optional)", type: "textarea", rows: 2 },
    { name: "linkUrl", label: "Button link (optional)", type: "text", placeholder: "https://... or /programs" },
    { name: "linkLabel", label: "Button text (optional)", type: "text", placeholder: "Learn more" },
    { name: "isActive", label: "Show this banner on the homepage", type: "checkbox" },
    { name: "sortOrder", label: "Sort order", type: "number" },
  ]

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-ivory">
      <header className="border-b border-gold/20 bg-navy">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 lg:px-8">
          <Logo variant="light" />
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-gold sm:flex"
            >
              View site
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Admin Dashboard</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy-text">Content Manager</h1>
        <p className="mt-1 text-sm text-navy-text/60">Welcome back, {userName}. Manage all site content below.</p>

        <Tabs defaultValue="news" className="mt-8">
          <TabsList className="bg-beige">
            <TabsTrigger value="news">News ({news.length})</TabsTrigger>
            <TabsTrigger value="media">Media ({media.length})</TabsTrigger>
            <TabsTrigger value="gallery">Gallery ({galleries.length})</TabsTrigger>
            <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
            <TabsTrigger value="programs">Programs ({programs.length})</TabsTrigger>
            <TabsTrigger value="banners">Banners ({banners.length})</TabsTrigger>
            <TabsTrigger value="ads">Ads ({ads.length})</TabsTrigger>
            <TabsTrigger value="people">People ({peopleCounts.counts.total})</TabsTrigger>
            <TabsTrigger value="organizations">Organizations ({organizationCounts.counts.total})</TabsTrigger>
            <TabsTrigger value="applications">
              Applications
              {applications.filter((a) => a.status === "pending").length > 0
                ? ` (${applications.filter((a) => a.status === "pending").length})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="team">Team ({team.length})</TabsTrigger>
            <TabsTrigger value="membership">Membership ({membershipPlans.length})</TabsTrigger>
            <TabsTrigger value="messages">
              Messages{messages.filter((m) => !m.isRead).length > 0 ? ` (${messages.filter((m) => !m.isRead).length})` : ""}
            </TabsTrigger>
            {isSuperAdmin ? <TabsTrigger value="users">Users ({users.length})</TabsTrigger> : null}
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="news" className="mt-6">
            <ResourceManager<News>
              title="News articles"
              singular="Article"
              items={news}
              fields={NEWS_FIELDS}
              organizationOptions={organizationOptions}
              onQuickCreateOrganization={quickCreateOrganization}
              emptyForm={{
                title: "",
                excerpt: "",
                content: "",
                category: "News",
                location: "",
                imageUrl: "",
                publishedAt: "",
                organizationIds: [],
              }}
              toForm={(a) => ({
                title: a.title,
                excerpt: a.excerpt,
                content: a.content ?? "",
                category: a.category,
                location: a.location ?? "",
                imageUrl: a.imageUrl ?? "",
                publishedAt: new Date(a.publishedAt).toISOString().slice(0, 10),
                organizationIds: a.organizationIds ?? [],
              })}
              render={{
                image: (a) => a.imageUrl,
                badge: (a) => a.category,
                meta: (a) => formatLongDate(a.publishedAt),
                title: (a) => a.title,
                viewHref: (a) => `/news/${a.slug}`,
              }}
              onCreate={(d) => createNews(d)}
              onUpdate={(id, d) => updateNews(id, d)}
              onDelete={(id) => deleteNews(id)}
            />
          </TabsContent>

          <TabsContent value="media" className="mt-6">
            <ResourceManager<Media>
              title="Media coverage"
              singular="Media item"
              items={media}
              fields={MEDIA_FIELDS}
              emptyForm={{
                title: "",
                type: "Article",
                source: "",
                url: "",
                thumbnailUrl: "",
                logoUrl: "",
                programId: "none",
                publishedAt: "",
                isFeatured: false,
                sortOrder: 0,
                excerpt: "",
              }}
              toForm={(m) => ({
                title: m.title,
                type: m.type ?? "Article",
                source: m.source ?? "",
                url: m.url ?? "",
                thumbnailUrl: m.thumbnailUrl ?? "",
                logoUrl: m.logoUrl ?? "",
                programId: m.programId ? String(m.programId) : "none",
                publishedAt: new Date(m.publishedAt).toISOString().slice(0, 10),
                isFeatured: m.isFeatured,
                sortOrder: m.sortOrder,
                excerpt: m.excerpt ?? "",
              })}
              render={{
                image: (m) => m.thumbnailUrl,
                badge: (m) => (m.isFeatured ? `Featured · ${m.type}` : m.type),
                meta: (m) => [formatLongDate(m.publishedAt), m.source].filter(Boolean).join(" · "),
                title: (m) => m.title,
                viewHref: (m) => m.url || undefined,
              }}
              onCreate={(d) => createMedia(d)}
              onUpdate={(id, d) => updateMedia(id, d)}
              onDelete={(id) => deleteMedia(id)}
            />
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <ResourceManager<Gallery>
              title="Photo galleries"
              singular="Album"
              items={galleries}
              fields={GALLERY_FIELDS}
              emptyForm={{
                title: "",
                category: "Event",
                eventDate: "",
                location: "",
                description: "",
                photos: [],
                isFeatured: false,
                sortOrder: 0,
              }}
              toForm={(g) => ({
                title: g.title,
                category: g.category ?? "Event",
                eventDate: g.eventDate ?? "",
                location: g.location ?? "",
                description: g.description ?? "",
                photos: g.photos ?? [],
                isFeatured: g.isFeatured,
                sortOrder: g.sortOrder,
              })}
              render={{
                image: (g) => g.coverImageUrl ?? g.photos?.[0]?.imageUrl ?? null,
                badge: (g) => (g.isFeatured ? `Featured · ${g.category}` : g.category),
                meta: (g) =>
                  [g.eventDate ? formatLongDate(g.eventDate) : null, `${g.photos?.length ?? 0} photos`]
                    .filter(Boolean)
                    .join(" · "),
                title: (g) => g.title,
                viewHref: () => "/gallery",
              }}
              onCreate={(d) => createGallery(d)}
              onUpdate={(id, d) => updateGallery(id, d)}
              onDelete={(id) => deleteGallery(id)}
            />
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <ResourceManager<Event>
              title="Events"
              singular="Event"
              items={events}
              fields={EVENT_FIELDS}
              emptyForm={{
                title: "",
                subtitle: "",
                excerpt: "",
                content: "",
                eventDate: "",
                timeLabel: "",
                venue: "",
                location: "",
                joinUrl: "",
                joinLabel: "",
                secondaryUrl: "",
                secondaryLabel: "",
                imageUrl: "",
                bannerUrl: "",
                highlights: [],
                agenda: [],
                sponsors: [],
                speakers: [],
                isFeatured: false,
                peopleIds: [],
                organizationIds: [],
              }}
              toForm={(e) => ({
                title: e.title,
                subtitle: e.subtitle ?? "",
                excerpt: e.excerpt,
                content: e.content,
                eventDate: e.eventDate,
                timeLabel: e.timeLabel ?? "",
                venue: e.venue ?? "",
                location: e.location ?? "",
                joinUrl: e.joinUrl ?? "",
                joinLabel: e.joinLabel ?? "",
                secondaryUrl: e.secondaryUrl ?? "",
                secondaryLabel: e.secondaryLabel ?? "",
                imageUrl: e.imageUrl ?? "",
                bannerUrl: e.bannerUrl ?? "",
                highlights: e.highlights ?? [],
                agenda: e.agenda ?? [],
                sponsors: e.sponsors ?? [],
                speakers: e.speakers ?? [],
                isFeatured: e.isFeatured,
                peopleIds: e.peopleIds ?? [],
                organizationIds: e.organizationIds ?? [],
              })}
              render={{
                image: (e) => e.imageUrl,
                badge: (e) => (e.isFeatured ? "Featured" : null),
                meta: (e) => formatLongDate(e.eventDate),
                title: (e) => e.title,
                viewHref: (e) => `/events/${e.slug}`,
              }}
              peopleOptions={peopleOptions}
              organizationOptions={organizationOptions}
              onQuickCreateOrganization={quickCreateOrganization}
              onCreate={(d) => createEvent(d)}
              onUpdate={(id, d) => updateEvent(id, d)}
              onDelete={(id) => deleteEvent(id)}
            />
          </TabsContent>

          <TabsContent value="programs" className="mt-6">
            <ResourceManager<Program>
              title="Programs"
              singular="Program"
              items={programs}
              fields={PROGRAM_FIELDS}
              emptyForm={{
                title: "",
                excerpt: "",
                content: "",
                icon: "Rocket",
                regions: "",
                imageUrl: "",
                bannerUrl: "",
                sortOrder: 0,
                partners: [],
                startups: [],
                gallery: [],
                peopleIds: [],
                organizationIds: [],
              }}
              toForm={(p) => ({
                title: p.title,
                excerpt: p.excerpt,
                content: p.content,
                icon: p.icon,
                regions: p.regions ?? "",
                imageUrl: p.imageUrl ?? "",
                bannerUrl: p.bannerUrl ?? "",
                sortOrder: p.sortOrder,
                partners: p.partners ?? [],
                startups: p.startups ?? [],
                gallery: p.gallery ?? [],
                peopleIds: p.peopleIds ?? [],
                organizationIds: p.organizationIds ?? [],
              })}
              render={{
                image: (p) => p.imageUrl,
                badge: (p) => p.icon,
                meta: (p) => p.regions ?? "",
                title: (p) => p.title,
                viewHref: (p) => `/programs/${p.slug}`,
              }}
              peopleOptions={peopleOptions}
              organizationOptions={organizationOptions}
              onQuickCreateOrganization={quickCreateOrganization}
              onCreate={(d) => createProgram(d)}
              onUpdate={(id, d) => updateProgram(id, d)}
              onDelete={(id) => deleteProgram(id)}
            />
          </TabsContent>

          <TabsContent value="people" className="mt-6">
            <PeoplePanel
              people={people}
              counts={peopleCounts.counts}
              byRole={peopleCounts.byRole}
              organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
            />
          </TabsContent>

          <TabsContent value="organizations" className="mt-6">
            <OrganizationsPanel
              organizations={organizations}
              counts={organizationCounts.counts}
              byType={organizationCounts.byType}
              eventProgramOptions={eventProgramOptions}
            />
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <ApplicationsPanel applications={applications} />
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <ResourceManager<Team>
              title="Team"
              singular="Member"
              items={team}
              fields={TEAM_FIELDS}
              emptyForm={{ name: "", role: "", company: "", bio: "", imageUrl: "", linkedinUrl: "", sortOrder: 0 }}
              toForm={(t) => ({
                name: t.name,
                role: t.role,
                company: t.company ?? "",
                bio: t.bio ?? "",
                imageUrl: t.imageUrl ?? "",
                linkedinUrl: t.linkedinUrl ?? "",
                sortOrder: t.sortOrder,
              })}
              render={{
                image: (t) => t.imageUrl,
                badge: (t) => t.role,
                meta: (t) => t.company ?? "",
                title: (t) => t.name,
              }}
              onCreate={(d) => createTeamMember(d)}
              onUpdate={(id, d) => updateTeamMember(id, d)}
              onDelete={(id) => deleteTeamMember(id)}
            />
          </TabsContent>

          <TabsContent value="partners" className="mt-6">
            <ResourceManager<Partner>
              title="Partners"
              singular="Partner"
              items={partners}
              fields={PARTNER_FIELDS}
              emptyForm={{ name: "", tier: "strategic", logoUrl: "", linkUrl: "", sortOrder: 0 }}
              toForm={(p) => ({
                name: p.name,
                tier: p.tier,
                logoUrl: p.logoUrl ?? "",
                linkUrl: p.linkUrl ?? "",
                sortOrder: p.sortOrder,
              })}
              render={{
                image: (p) => p.logoUrl,
                badge: (p) => (p.tier === "institution" ? "Institution" : "Strategic"),
                meta: (p) => p.linkUrl ?? "",
                title: (p) => p.name,
              }}
              onCreate={(d) => createPartner(d)}
              onUpdate={(id, d) => updatePartner(id, d)}
              onDelete={(id) => deletePartner(id)}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <ResourceManager<Member>
              title="Members"
              singular="Member"
              items={members}
              fields={MEMBER_FIELDS}
              emptyForm={{
                companyName: "",
                category: "corporate",
                founderName: "",
                designation: "",
                websiteUrl: "",
                contactUrl: "",
                contactEmail: "",
                logoUrl: "",
                description: "",
                sortOrder: 0,
              }}
              toForm={(m) => ({
                companyName: m.companyName,
                category: m.category,
                founderName: m.founderName ?? "",
                designation: m.designation ?? "",
                websiteUrl: m.websiteUrl ?? "",
                contactUrl: m.contactUrl ?? "",
                contactEmail: m.contactEmail ?? "",
                logoUrl: m.logoUrl ?? "",
                description: m.description ?? "",
                sortOrder: m.sortOrder,
              })}
              render={{
                image: (m) => m.logoUrl,
                badge: (m) => memberCategoryLabel(m.category),
                meta: (m) => [m.founderName, m.designation].filter(Boolean).join(" — "),
                title: (m) => m.companyName,
              }}
              onCreate={(d) => createMember(d)}
              onUpdate={(id, d) => updateMember(id, d)}
              onDelete={(id) => deleteMember(id)}
            />
          </TabsContent>

          <TabsContent value="membership" className="mt-6">
            <ResourceManager<MembershipPlan>
              title="Membership plans"
              singular="Plan"
              items={membershipPlans}
              fields={MEMBERSHIP_FIELDS}
              emptyForm={{
                name: "",
                icon: "Users",
                price: "Free",
                priceNote: "",
                periodLabel: "1 Year Membership",
                badge: "",
                description: "",
                features: [],
                ctaLabel: "Join Now",
                ctaUrl: "/contact",
                footnote: "",
                accent: "gold",
                isHighlighted: false,
                sortOrder: 0,
              }}
              toForm={(p) => ({
                name: p.name,
                icon: p.icon,
                price: p.price,
                priceNote: p.priceNote ?? "",
                periodLabel: p.periodLabel ?? "",
                badge: p.badge ?? "",
                description: p.description,
                features: (p.features ?? []).map((text) => ({ text })),
                ctaLabel: p.ctaLabel,
                ctaUrl: p.ctaUrl ?? "",
                footnote: p.footnote ?? "",
                accent: p.accent,
                isHighlighted: p.isHighlighted,
                sortOrder: p.sortOrder,
              })}
              render={{
                badge: (p) => (p.isHighlighted ? "Highlighted" : p.price),
                meta: (p) => `${p.features?.length ?? 0} features`,
                title: (p) => p.name,
              }}
              onCreate={(d) => createMembershipPlan(d)}
              onUpdate={(id, d) => updateMembershipPlan(id, d)}
              onDelete={(id) => deleteMembershipPlan(id)}
            />
            <MembershipContentPanel
              content={membershipContent}
              plans={membershipPlans.map((p) => ({ id: p.id, name: p.name }))}
            />
          </TabsContent>

          <TabsContent value="banners" className="mt-6">
            <ResourceManager<Banner>
              title="Homepage banners"
              singular="Banner"
              items={banners}
              fields={BANNER_FIELDS}
              emptyForm={{
                imageUrl: "",
                title: "",
                subtitle: "",
                linkUrl: "",
                linkLabel: "",
                isActive: true,
                sortOrder: 0,
              }}
              toForm={(b) => ({
                imageUrl: b.imageUrl ?? "",
                title: b.title ?? "",
                subtitle: b.subtitle ?? "",
                linkUrl: b.linkUrl ?? "",
                linkLabel: b.linkLabel ?? "",
                isActive: b.isActive,
                sortOrder: b.sortOrder,
              })}
              render={{
                image: (b) => b.imageUrl,
                badge: (b) => (b.isActive ? "Active" : "Hidden"),
                meta: (b) => b.linkUrl ?? "",
                title: (b) => b.title || "Untitled banner",
              }}
              onCreate={(d) => createBanner(d)}
              onUpdate={(id, d) => updateBanner(id, d)}
              onDelete={(id) => deleteBanner(id)}
            />
          </TabsContent>

          <TabsContent value="ads" className="mt-6">
            <AdsManager ads={ads} subscribers={subscribers} />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <MessagesPanel messages={messages} />
          </TabsContent>

          {isSuperAdmin ? (
            <TabsContent value="users" className="mt-6">
              <UserManager users={users} currentUserId={currentUserId} />
            </TabsContent>
          ) : null}

          <TabsContent value="settings" className="mt-6">
            <SettingsPanel settings={settings} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
