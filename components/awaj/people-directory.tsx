"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search, ExternalLink, CalendarDays, Layers, Building2, LayoutGrid, Rows3 } from "lucide-react"
import type { DirectoryPerson } from "@/app/actions/people"
import { newestFirstThenShuffle, recencyMs } from "@/lib/shuffle"

const PAGE_SIZE = 24

export function PeopleDirectory({ people }: { people: DirectoryPerson[] }) {
  const [query, setQuery] = useState("")
  const [activeRole, setActiveRole] = useState("All")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [groupByOrg, setGroupByOrg] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const roles = useMemo(() => {
    const set = new Set<string>()
    for (const p of people) for (const r of p.roleTypes ?? []) set.add(r)
    // "Ecosystem Partner" stays as a tag on cards but is not offered as a filter chip.
    set.delete("Ecosystem Partner")
    return ["All", ...Array.from(set).sort()]
  }, [people])

  // Base ordering: newest added/updated person first, remaining shuffled. Done AFTER mount
  // (not during render) so the SSR HTML and first client paint match — avoiding hydration
  // mismatches — while still producing a fresh random order on every page load/visit.
  const [ordered, setOrdered] = useState<DirectoryPerson[]>(people)
  useEffect(() => {
    setOrdered(newestFirstThenShuffle(people, (p) => recencyMs(p.createdAt, p.updatedAt)))
  }, [people])

  const filtered = useMemo(() => {
    return ordered.filter((p) => {
      const matchesRole = activeRole === "All" || (p.roleTypes ?? []).includes(activeRole)
      const haystack = `${p.fullName} ${p.jobTitle ?? ""} ${p.companyName ?? ""}`.toLowerCase()
      const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase())
      return matchesRole && matchesQuery
    })
  }, [ordered, activeRole, query])

  // Reset paging whenever the filtered set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, activeRole])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // Grouped view: members bucketed under their linked organisation (unlinked people last).
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string | null; people: DirectoryPerson[] }>()
    for (const p of filtered) {
      const key = p.organizationId != null ? `org-${p.organizationId}` : "none"
      if (!map.has(key)) map.set(key, { name: p.organizationName, people: [] })
      map.get(key)!.people.push(p)
    }
    const groups = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }))
    // Named organisations first (alphabetical), the "no organisation" bucket last.
    groups.sort((a, b) => {
      if (a.key === "none") return 1
      if (b.key === "none") return -1
      return (a.name ?? "").localeCompare(b.name ?? "")
    })
    return groups
  }, [filtered])

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))
        }
      },
      { rootMargin: "400px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, filtered.length])

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-text/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, or role..."
            className="h-11 w-full rounded-full border border-gold/30 bg-white pl-10 pr-4 text-sm text-navy-text outline-none transition-colors focus:border-gold"
            aria-label="Search people"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-gold/30 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setGroupByOrg(false)}
              aria-pressed={!groupByOrg}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !groupByOrg ? "bg-awaj-red text-white" : "text-navy-text/60 hover:text-navy-text"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All people
            </button>
            <button
              type="button"
              onClick={() => setGroupByOrg(true)}
              aria-pressed={groupByOrg}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                groupByOrg ? "bg-awaj-red text-white" : "text-navy-text/60 hover:text-navy-text"
              }`}
            >
              <Rows3 className="h-3.5 w-3.5" />
              By organisation
            </button>
          </div>
          <p className="text-sm text-navy-text/55">
            {filtered.length} {filtered.length === 1 ? "person" : "people"}
          </p>
        </div>
      </div>

      {/* Role filters */}
      <div className="mt-5 flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveRole(role)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeRole === role
                ? "border-awaj-red bg-awaj-red text-white"
                : "border-gold/30 bg-white text-navy-text/70 hover:border-gold hover:text-navy-text"
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-gold/20 bg-white p-12 text-center">
          <h2 className="font-serif text-xl font-bold text-navy-text">No people found</h2>
          <p className="mt-2 text-sm text-navy-text/60">Try a different search or filter.</p>
        </div>
      ) : groupByOrg ? (
        <div className="mt-8 flex flex-col gap-10">
          {grouped.map((group) => (
            <section key={group.key}>
              <div className="flex items-center gap-2 border-b border-gold/20 pb-2">
                {group.key === "none" ? (
                  <h2 className="font-serif text-lg font-bold text-navy-text/70">Independent &amp; unaffiliated</h2>
                ) : (
                  <h2 className="inline-flex items-center gap-2 font-serif text-lg font-bold text-navy-text">
                    <Building2 className="h-4 w-4 text-gold" />
                    {group.name}
                  </h2>
                )}
                <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-navy-text/60">
                  {group.people.length}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {group.people.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="mt-8 flex justify-center py-6" aria-hidden="true">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            </div>
          ) : (
            filtered.length > PAGE_SIZE && (
              <p className="mt-8 text-center text-sm text-navy-text/50">
                You&apos;ve reached the end · {filtered.length} people
              </p>
            )
          )}
        </>
      )}
    </div>
  )
}

function PersonCard({ person }: { person: DirectoryPerson }) {
  const roles = person.roleTypes ?? []
  const hasConnections = person.events.length > 0 || person.programs.length > 0
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gold/20 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-beige">
        <img
          src={person.profilePhoto || "/placeholder.svg?height=400&width=400&query=professional+headshot"}
          alt={person.fullName}
          className="h-full w-full object-cover"
        />
        {person.featured && (
          <span className="absolute left-2 top-2 rounded-full bg-awaj-red px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-serif text-sm font-bold leading-snug text-navy-text">{person.fullName}</h3>
        {person.jobTitle && <p className="mt-0.5 text-xs leading-snug text-navy-text/65">{person.jobTitle}</p>}

        {/* Company logo (preferred) or company name */}
        {person.showCompanyLogo && person.companyLogo ? (
          <img
            src={person.companyLogo || "/placeholder.svg"}
            alt={person.companyName ? `${person.companyName} logo` : "Company logo"}
            className="mt-2 h-10 w-auto max-w-[150px] object-contain"
          />
        ) : person.companyName ? (
          <p className="mt-1 text-xs font-semibold text-gold">{person.companyName}</p>
        ) : null}

        {person.organizationName && (
          <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
            <Building2 className="h-3 w-3" />
            {person.organizationName}
          </p>
        )}

        {roles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {roles.slice(0, 2).map((r) => (
              <span key={r} className="rounded-full bg-navy-text px-2 py-0.5 text-[10px] font-semibold text-white">
                {r}
              </span>
            ))}
          </div>
        )}

        {hasConnections && (
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-gold/15 pt-2.5">
            {person.events.length > 0 && (
              <div className="flex items-start gap-1.5 text-[11px] leading-snug text-navy-text/70">
                <CalendarDays className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                <span className="flex flex-wrap gap-x-1">
                  {person.events.map((e, i) => (
                    <span key={e.id}>
                      <Link href={`/events/${e.slug}`} className="font-medium text-navy-text hover:text-awaj-red">
                        {e.title}
                      </Link>
                      {i < person.events.length - 1 ? "," : ""}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {person.programs.length > 0 && (
              <div className="flex items-start gap-1.5 text-[11px] leading-snug text-navy-text/70">
                <Layers className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                <span className="flex flex-wrap gap-x-1">
                  {person.programs.map((p, i) => (
                    <span key={p.id}>
                      <Link href={`/programs/${p.slug}`} className="font-medium text-navy-text hover:text-awaj-red">
                        {p.title}
                      </Link>
                      {i < person.programs.length - 1 ? "," : ""}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        )}

        {person.showLinkedin && person.linkedinUrl && (
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-awaj-red hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            LinkedIn
          </a>
        )}
      </div>
    </article>
  )
}
