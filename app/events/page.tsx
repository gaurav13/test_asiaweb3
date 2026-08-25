import Link from "next/link"
import { ArrowUpRight, MapPin, Clock } from "lucide-react"
import { SiteHeader } from "@/components/awaj/site-header"
import { SiteFooter } from "@/components/awaj/site-footer"
import { getAllEvents } from "@/app/actions/events"
import { dateParts, formatLongDate } from "@/lib/format-date"
import { resolveEventCardImage } from "@/lib/images"
import { buildPageMetadata } from "@/lib/seo"
import { AdSlot } from "@/components/ads/ad-slot"
import { PageAds } from "@/components/ads/page-ads"

export async function generateMetadata() {
  return buildPageMetadata({
    path: "/events",
    title: "Events",
    description:
      "Upcoming events, demo days, and VC Connect sessions from Asia Web3 & AI Alliance Japan (AWAJ).",
  })
}

export default async function EventsPage() {
  const events = await getAllEvents()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  // Upcoming: soonest first (getAllEvents already returns ascending by date).
  const upcoming = events.filter((e) => new Date(e.eventDate) >= today)
  // Past: most recent first.
  const past = events
    .filter((e) => new Date(e.eventDate) < today)
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
  const [featured, ...restUpcoming] = upcoming

  return (
    <main className="min-h-svh bg-ivory">
      <SiteHeader />

      <section className="border-b border-gold/20 bg-navy">
        <div className="mx-auto max-w-[1280px] px-5 py-14 lg:px-10 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Events</p>
          <h1 className="mt-3 max-w-3xl text-balance font-serif text-4xl font-bold leading-tight text-white lg:text-5xl">
            Upcoming Events &amp; Programs
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-white/70">
            Join our Demo Days, VC Connect sessions, and exhibitions across Asia, Japan, and beyond.
          </p>
          <p className="mt-6 text-sm font-semibold text-gold">
            {events.length} {events.length === 1 ? "event" : "events"} total
          </p>
        </div>
      </section>

      <AdSlot page="events" placement="top" className="px-5 pt-10 lg:px-10" />

      <div className="mx-auto max-w-[1280px] px-5 py-12 lg:px-10 lg:py-16">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-gold/20 bg-white p-12 text-center">
            <h2 className="font-serif text-xl font-bold text-navy-text">No events yet</h2>
            <p className="mt-2 text-sm text-navy-text/60">Check back soon for upcoming AWAJ events.</p>
          </div>
        ) : (
          <>
            {featured && (
              <Link
                href={`/events/${featured.slug}`}
                className="group grid grid-cols-1 overflow-hidden rounded-3xl border border-gold/20 bg-navy text-white shadow-sm transition-shadow hover:shadow-md lg:grid-cols-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-beige lg:aspect-auto lg:min-h-[340px]">
                  <img
                    src={resolveEventCardImage(featured)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 z-10 rounded-full bg-awaj-red px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Featured
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-4 p-8 lg:p-10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                    {formatLongDate(featured.eventDate)}
                  </p>
                  <h2 className="text-balance font-serif text-2xl font-bold leading-snug lg:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="text-pretty leading-relaxed text-white/70">{featured.excerpt}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                    {featured.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gold" />
                        {featured.location}
                      </span>
                    )}
                    {featured.timeLabel && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gold" />
                        {featured.timeLabel}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors group-hover:text-gold">
                    View details
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            )}

            {restUpcoming.length > 0 && (
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {restUpcoming.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}

            <AdSlot page="events" placement="mid" className="mt-12" />

            {past.length > 0 && (
              <>
                <h2 className="mt-16 mb-6 font-serif text-2xl font-bold text-navy-text">Past Events</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((e) => (
                    <EventCard key={e.id} event={e} muted />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <AdSlot page="events" placement="bottom" className="px-5 pb-12 lg:px-10" />

      <SiteFooter />
      <PageAds page="events" />
    </main>
  )
}

function EventCard({
  event,
  muted = false,
}: {
  event: Awaited<ReturnType<typeof getAllEvents>>[number]
  muted?: boolean
}) {
  const d = dateParts(event.eventDate)
  const cover = resolveEventCardImage(event)
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={cover}
          alt=""
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${muted ? "opacity-80 grayscale-[30%]" : ""}`}
        />
        <span className="absolute left-3 top-3 flex flex-col items-center rounded-lg bg-awaj-red px-3 py-1.5 text-white">
          <span className="text-[10px] font-semibold uppercase tracking-wide">{d.month}</span>
          <span className="text-lg font-bold leading-none">{d.day}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">
          {d.month} {d.day}, {d.year}
        </p>
        <h3 className="mt-2 text-balance font-serif text-lg font-bold leading-snug text-navy-text">{event.title}</h3>
        {event.location && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-text/65">
            <MapPin className="h-3.5 w-3.5 text-gold" />
            {event.location}
          </p>
        )}
      </div>
    </Link>
  )
}
