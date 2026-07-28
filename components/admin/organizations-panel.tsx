"use client"

import type React from "react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Search, Star, Eye, EyeOff, Check, Download, Building2, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "./image-upload"
import { resolveImageUrl } from "@/lib/images"
import { ORGANIZATION_TYPES } from "@/lib/db/schema"
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  setOrganizationStatus,
  setOrganizationHomepage,
  setOrganizationConnections,
  importOrganizations,
} from "@/app/actions/organizations"
import { MEMBER_TAGS } from "@/lib/organization-types"
import type { AdminOrganization, OrganizationInput, EventProgramOptions } from "@/lib/organization-types"

type Counts = { total: number; approved: number; pending: number; hidden: number }

const EMPTY: OrganizationInput = {
  name: "",
  type: "Member",
  tags: [],
  logoUrl: "",
  websiteUrl: "",
  country: "",
  industry: "",
  description: "",
  status: "approved",
  featured: false,
  showOnHomepage: true,
  sortOrder: 0,
}

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  hidden: "Hidden",
}

export function OrganizationsPanel({
  organizations,
  counts,
  byType,
  eventProgramOptions,
}: {
  organizations: AdminOrganization[]
  counts: Counts
  byType: Record<string, number>
  eventProgramOptions: EventProgramOptions
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminOrganization | null>(null)
  const [form, setForm] = useState<OrganizationInput>(EMPTY)
  // Event/program connections, editable directly from the member area.
  const [eventIds, setEventIds] = useState<number[]>([])
  const [programIds, setProgramIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    return organizations.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false
      if (statusFilter !== "all" && o.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${o.name} ${o.country ?? ""} ${o.industry ?? ""} ${o.type}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [organizations, typeFilter, statusFilter, search])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setEventIds([])
    setProgramIds([])
    setError(null)
    setShowForm(true)
  }

  function openEdit(o: AdminOrganization) {
    setEditing(o)
    setForm({
      name: o.name,
      type: o.type,
      tags: o.tags ?? [],
      logoUrl: o.logoUrl ?? "",
      websiteUrl: o.websiteUrl ?? "",
      country: o.country ?? "",
      industry: o.industry ?? "",
      description: o.description ?? "",
      status: o.status,
      featured: o.featured,
      showOnHomepage: o.showOnHomepage,
      sortOrder: o.sortOrder,
    })
    setEventIds(o.events.map((e) => e.id))
    setProgramIds(o.programs.map((p) => p.id))
    setError(null)
    setShowForm(true)
  }

  function toggleTag(tag: string) {
    setForm((prev) => {
      const current = prev.tags ?? []
      const has = current.includes(tag)
      return { ...prev, tags: has ? current.filter((t) => t !== tag) : [...current, tag] }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError("Organization name is required.")
      return
    }
    startTransition(async () => {
      try {
        const orgId = editing ? (await updateOrganization(editing.id, form), editing.id) : await createOrganization(form)
        await setOrganizationConnections(orgId, eventIds, programIds)
        setShowForm(false)
        router.refresh()
      } catch (err) {
        // Duplicate-name guard surfaces here as a friendly warning.
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete(o: AdminOrganization) {
    const memberWarning =
      o.memberCount > 0
        ? ` ${o.memberCount} linked ${o.memberCount === 1 ? "person" : "people"} will be kept but unlinked from this organisation.`
        : ""
    if (!confirm(`Delete "${o.name}"? This also removes its event/program connections.${memberWarning}`)) return
    startTransition(async () => {
      try {
        await deleteOrganization(o.id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.")
      }
    })
  }

  function handleStatus(id: number, status: "approved" | "pending" | "hidden") {
    startTransition(async () => {
      try {
        await setOrganizationStatus(id, status)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update status.")
      }
    })
  }

  function handleHomepage(id: number, showOnHomepage: boolean) {
    startTransition(async () => {
      try {
        await setOrganizationHomepage(id, showOnHomepage)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update homepage visibility.")
      }
    })
  }

  function handleImport() {
    if (
      !confirm(
        "Import all existing members, partners, event sponsors, and program partners/startups into the central directory? Entries are matched by name (no duplicates).",
      )
    )
      return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const res = await importOrganizations()
        setNotice(
          `Imported ${res.imported} new ${res.imported === 1 ? "organization" : "organizations"} and linked ${res.linked} event/program connection${res.linked === 1 ? "" : "s"}.`,
        )
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.")
      }
    })
  }

  const counterCards = [
    { label: "Total", value: counts.total },
    { label: "Approved", value: counts.approved },
    { label: "Pending", value: counts.pending },
    { label: "Hidden", value: counts.hidden },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-text">Organizations Directory</h2>
          <p className="mt-1 text-sm text-navy-text/60">
            One central list for every organization — members, partners, startups, sponsors, government, VCs, and media.
            Events and programs link to this list, and approved entries appear automatically on the Members page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleImport}
            disabled={isPending}
            variant="outline"
            className="rounded-full border-gold/40 text-navy-text hover:bg-beige"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Import existing
          </Button>
          <Button onClick={openCreate} className="rounded-full bg-awaj-red text-white hover:bg-awaj-red/90">
            <Plus className="mr-1.5 h-4 w-4" />
            New Organization
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-navy-text">{notice}</div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-awaj-red/30 bg-awaj-red/10 px-4 py-3 text-sm text-awaj-red">
          {error}
        </div>
      ) : null}

      {/* Counters */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {counterCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gold/20 bg-white p-4">
            <p className="text-2xl font-bold text-navy-text">{c.value}</p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-navy-text/55">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Type chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <TypeChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label="All Types" count={counts.total} />
        {ORGANIZATION_TYPES.map((t) => (
          <TypeChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            label={t}
            count={byType[t] ?? 0}
          />
        ))}
      </div>

      {/* Search + status filter */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-text/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, country, industry..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm text-navy-text"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {/* List */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-gold/20 bg-white">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="font-serif text-lg font-bold text-navy-text">No organizations found</h3>
            <p className="mt-2 text-sm text-navy-text/60">
              Adjust your filters, add a new organization, or import your existing data.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gold/15">
            {filtered.map((o) => (
              <li key={o.id} className="flex items-center gap-4 p-4 hover:bg-beige/30">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-beige">
                  {o.logoUrl ? (
                    <img
                      src={resolveImageUrl(o.logoUrl) || "/placeholder.svg"}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-navy-text/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-navy-text">{o.name}</h3>
                    {o.featured ? <Star className="h-3.5 w-3.5 fill-gold text-gold" /> : null}
                    <span className="rounded bg-navy-text px-1.5 py-0.5 text-[10px] font-medium text-white">{o.type}</span>
                    <StatusBadge status={o.status} />
                    {(o.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-navy-text"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-navy-text/60">
                    {[o.country, o.industry].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-text/45">
                    <span className={o.memberCount > 0 ? "font-semibold text-gold" : ""}>
                      {o.memberCount} member{o.memberCount === 1 ? "" : "s"}
                    </span>{" "}
                    · {o.eventCount} event{o.eventCount === 1 ? "" : "s"} · {o.programCount} program
                    {o.programCount === 1 ? "" : "s"}
                  </p>
                  {o.members.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {o.members.slice(0, 6).map((m) => (
                        <span
                          key={`m-${m.id}`}
                          title={[m.fullName, m.jobTitle].filter(Boolean).join(" · ")}
                          className="inline-flex items-center gap-1 rounded-full bg-beige px-2 py-0.5 text-[10px] font-medium text-navy-text"
                        >
                          <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white">
                            {m.profilePhoto ? (
                              <img
                                src={resolveImageUrl(m.profilePhoto) || "/placeholder.svg"}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </span>
                          {m.fullName}
                          {m.status !== "published" ? (
                            <span className="text-navy-text/40">({m.status})</span>
                          ) : null}
                        </span>
                      ))}
                      {o.members.length > 6 ? (
                        <span className="text-[10px] font-medium text-navy-text/50">
                          +{o.members.length - 6} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {o.events.length > 0 || o.programs.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {o.events.map((e) => (
                        <span
                          key={`e-${e.id}`}
                          className="rounded-full bg-awaj-red/10 px-2 py-0.5 text-[10px] font-medium text-awaj-red"
                        >
                          {e.title}
                        </span>
                      ))}
                      {o.programs.map((p) => (
                        <span
                          key={`p-${p.id}`}
                          className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy-text"
                        >
                          {p.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {o.status !== "approved" ? (
                    <button
                      type="button"
                      onClick={() => handleStatus(o.id, "approved")}
                      disabled={isPending}
                      className="rounded-lg p-2 text-emerald-600/80 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                      aria-label="Approve"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : null}
                  {o.status !== "hidden" ? (
                    <button
                      type="button"
                      onClick={() => handleStatus(o.id, "hidden")}
                      disabled={isPending}
                      className="rounded-lg p-2 text-navy-text/60 transition-colors hover:bg-beige hover:text-navy-text"
                      aria-label="Hide"
                      title="Hide from Members list"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatus(o.id, "approved")}
                      disabled={isPending}
                      className="rounded-lg p-2 text-navy-text/60 transition-colors hover:bg-beige hover:text-navy-text"
                      aria-label="Unhide"
                      title="Show on Members list"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleHomepage(o.id, !o.showOnHomepage)}
                    disabled={isPending}
                    className={`rounded-lg p-2 transition-colors hover:bg-beige ${
                      o.showOnHomepage ? "text-awaj-red" : "text-navy-text/40 hover:text-navy-text"
                    }`}
                    aria-label={o.showOnHomepage ? "Remove from homepage slider" : "Add to homepage slider"}
                    title={o.showOnHomepage ? "Showing in homepage slider — click to hide" : "Hidden from homepage slider — click to show"}
                  >
                    <Home className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(o)}
                    className="rounded-lg p-2 text-navy-text/60 transition-colors hover:bg-beige hover:text-navy-text"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(o)}
                    className="rounded-lg p-2 text-awaj-red/70 transition-colors hover:bg-awaj-red/10 hover:text-awaj-red"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Slide-over form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={() => setShowForm(false)}>
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-ivory shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
              <h2 className="font-serif text-xl font-bold text-navy-text">
                {editing ? "Edit Organization" : "New Organization"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-navy-text/60 hover:bg-beige"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <Label>Logo</Label>
                <ImageUpload
                  value={form.logoUrl ?? ""}
                  onChange={(url) => setForm({ ...form, logoUrl: url })}
                  hint="Recommended 400 × 400 px. Use a transparent PNG (or WebP) for the cleanest look. The full logo is shown without cropping."
                />
              </div>

              <Field label="Organization name" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Type / category</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="h-9 rounded-md border border-input bg-white px-3 text-sm text-navy-text"
                  >
                    {ORGANIZATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="h-9 rounded-md border border-input bg-white px-3 text-sm text-navy-text"
                  >
                    <option value="approved">Approved (public)</option>
                    <option value="pending">Pending review</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Membership tags</Label>
                <p className="-mt-1 text-xs text-navy-text/55">
                  A company can carry several tags. All selected tags show as chips on the Members page and can be
                  filtered.
                </p>
                <div className="flex flex-wrap gap-2">
                  {MEMBER_TAGS.map((tag) => {
                    const active = (form.tags ?? []).includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "border-awaj-red bg-awaj-red text-white"
                            : "border-gold/40 bg-white text-navy-text/70 hover:bg-beige"
                        }`}
                      >
                        {active ? <Check className="h-3 w-3" /> : null}
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </Field>
                <Field label="Industry">
                  <Input value={form.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                </Field>
              </div>

              <Field label="Website" hint="Full URL, e.g. https://example.com">
                <Input
                  value={form.websiteUrl ?? ""}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                />
              </Field>

              <Field label="Short description">
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-end">
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.featured ?? false}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                      className="h-4 w-4 rounded border-input accent-awaj-red"
                    />
                    <span className="text-sm font-medium text-navy-text">Featured (shown first)</span>
                  </label>
                </div>
                <Field label="Sort order">
                  <Input
                    type="number"
                    value={String(form.sortOrder ?? 0)}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-gold/20 bg-white p-3">
                <input
                  type="checkbox"
                  checked={form.showOnHomepage ?? true}
                  onChange={(e) => setForm({ ...form, showOnHomepage: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-awaj-red"
                />
                <span>
                  <span className="block text-sm font-medium text-navy-text">Show in homepage members slider</span>
                  <span className="mt-0.5 block text-xs text-navy-text/55">
                    When enabled, this company can appear in the &ldquo;New Members&rdquo; slider on the homepage. Uncheck
                    to keep it on the Members page but hide it from the homepage.
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-gold/20 bg-white p-4">
                <h3 className="font-semibold text-navy-text">Connections</h3>
                <p className="mt-0.5 text-xs text-navy-text/55">
                  Link this organization to any number of events and programs. These links also appear on the event and
                  program pages, and changes here update both sides.
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  <ConnectionPicker
                    label="Events"
                    options={eventProgramOptions.events}
                    selected={eventIds}
                    onToggle={(id) =>
                      setEventIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                    }
                    emptyText="No events have been created yet."
                  />
                  <ConnectionPicker
                    label="Programs"
                    options={eventProgramOptions.programs}
                    selected={programIds}
                    onToggle={(id) =>
                      setProgramIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                    }
                    emptyText="No programs have been created yet."
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-awaj-red" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-auto flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 rounded-full">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-full bg-navy text-white hover:bg-navy/90"
                >
                  {isPending ? "Saving..." : editing ? "Save changes" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    hidden: "bg-navy-text/10 text-navy-text/60",
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? styles.hidden}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function TypeChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-navy bg-navy text-white" : "border-gold/40 bg-white text-navy-text/70 hover:border-gold"
      }`}
    >
      {label} <span className={active ? "text-white/70" : "text-navy-text/40"}>({count})</span>
    </button>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {required ? <span className="text-awaj-red"> *</span> : null}
      </Label>
      {hint ? <p className="-mt-1 text-xs text-navy-text/55">{hint}</p> : null}
      {children}
    </div>
  )
}

function ConnectionPicker({
  label,
  options,
  selected,
  onToggle,
  emptyText,
}: {
  label: string
  options: { id: number; title: string }[]
  selected: number[]
  onToggle: (id: number) => void
  emptyText: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-navy-text/45">{selected.length} selected</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-navy-text/50">{emptyText}</p>
      ) : (
        <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-gold/20 bg-beige/20 p-2">
          {options.map((opt) => {
            const checked = selected.includes(opt.id)
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  checked ? "bg-white text-navy-text" : "text-navy-text/70 hover:bg-white/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.id)}
                  className="h-4 w-4 rounded border-input accent-awaj-red"
                />
                <span className="truncate">{opt.title}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
