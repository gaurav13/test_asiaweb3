"use client"

import type React from "react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Search, Star, ArrowUp, ArrowDown, Download, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "./image-upload"
import { resolveImageUrl } from "@/lib/images"
import { PEOPLE_ROLE_TYPES } from "@/lib/db/schema"
import {
  createPerson,
  updatePerson,
  deletePerson,
  importPeopleFromSources,
  reorderPerson,
  type PersonWithOrg,
  type PersonInput,
} from "@/app/actions/people"

type Counts = { total: number; published: number; draft: number; homepage: number }
type OrgOption = { id: number; name: string }

const EMPTY: PersonInput = {
  fullName: "",
  profilePhoto: "",
  jobTitle: "",
  companyName: "",
  companyLogo: "",
  linkedinUrl: "",
  email: "",
  country: "",
  bio: "",
  organizationId: null,
  roleTypes: [],
  tags: [],
  featured: false,
  status: "published",
  sortOrder: 0,
  showOnHomepage: false,
  showCompanyLogo: true,
  showLinkedin: true,
  showRoleBadge: false,
}

export function PeoplePanel({
  people,
  counts,
  byRole,
  organizations = [],
}: {
  people: PersonWithOrg[]
  counts: Counts
  byRole: Record<string, number>
  organizations?: OrgOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PersonWithOrg | null>(null)
  const [form, setForm] = useState<PersonInput>(EMPTY)
  const [tagsText, setTagsText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (roleFilter !== "all" && !(p.roleTypes ?? []).includes(roleFilter)) return false
      if (statusFilter === "homepage" && !p.showOnHomepage) return false
      else if (statusFilter !== "all" && statusFilter !== "homepage" && p.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${p.fullName} ${p.companyName ?? ""} ${p.organizationName ?? ""} ${p.jobTitle ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [people, roleFilter, statusFilter, search])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setTagsText("")
    setError(null)
    setShowForm(true)
  }

  function openEdit(p: PersonWithOrg) {
    setEditing(p)
    setForm({
      fullName: p.fullName,
      profilePhoto: p.profilePhoto ?? "",
      jobTitle: p.jobTitle ?? "",
      companyName: p.companyName ?? "",
      companyLogo: p.companyLogo ?? "",
      linkedinUrl: p.linkedinUrl ?? "",
      email: p.email ?? "",
      country: p.country ?? "",
      bio: p.bio ?? "",
      organizationId: p.organizationId ?? null,
      roleTypes: p.roleTypes ?? [],
      tags: p.tags ?? [],
      featured: p.featured,
      status: p.status,
      sortOrder: p.sortOrder,
      showOnHomepage: p.showOnHomepage,
      showCompanyLogo: p.showCompanyLogo,
      showLinkedin: p.showLinkedin,
      showRoleBadge: p.showRoleBadge,
    })
    setTagsText((p.tags ?? []).join(", "))
    setError(null)
    setShowForm(true)
  }

  function toggleRole(role: string) {
    const current = form.roleTypes ?? []
    setForm({
      ...form,
      roleTypes: current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.fullName.trim()) {
      setError("Full name is required.")
      return
    }
    const payload: PersonInput = {
      ...form,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }
    startTransition(async () => {
      try {
        if (editing) await updatePerson(editing.id, payload)
        else await createPerson(payload)
        setShowForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this person? This also removes their event/program connections.")) return
    startTransition(async () => {
      try {
        await deletePerson(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.")
      }
    })
  }

  function handleImport() {
    if (
      !confirm(
        "Import all team members and event speakers into this directory? Existing people are matched by name (no duplicates), and everyone is re-ordered Team → Government → others.",
      )
    )
      return
    setError(null)
    startTransition(async () => {
      try {
        const res = await importPeopleFromSources()
        setNotice(`Imported ${res.imported} new ${res.imported === 1 ? "person" : "people"}. Directory now has ${res.total}.`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.")
      }
    })
  }

  function handleReorder(id: number, direction: "up" | "down") {
    startTransition(async () => {
      try {
        await reorderPerson(id, direction)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reorder.")
      }
    })
  }

  // Reordering only makes sense against the full, unfiltered, globally-ordered list.
  const reorderEnabled = roleFilter === "all" && statusFilter === "all" && !search.trim()

  const counterCards = [
    { label: "Total People", value: counts.total },
    { label: "Published", value: counts.published },
    { label: "Drafts", value: counts.draft },
    { label: "On Homepage", value: counts.homepage },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-text">People Management</h2>
          <p className="mt-1 text-sm text-navy-text/60">
            One central place for leadership, advisors, speakers, mentors, and ecosystem leaders.
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
            Import team &amp; speakers
          </Button>
          <Button onClick={openCreate} className="rounded-full bg-awaj-red text-white hover:bg-awaj-red/90">
            <Plus className="mr-1.5 h-4 w-4" />
            New Person
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-navy-text">
          {notice}
        </div>
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

      {/* Role chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <RoleChip active={roleFilter === "all"} onClick={() => setRoleFilter("all")} label="All Roles" count={counts.total} />
        {PEOPLE_ROLE_TYPES.map((role) => (
          <RoleChip
            key={role}
            active={roleFilter === role}
            onClick={() => setRoleFilter(role)}
            label={role}
            count={byRole[role] ?? 0}
          />
        ))}
      </div>

      {/* Search + status filter */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-text/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, title, tag..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm text-navy-text"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="homepage">On Homepage</option>
        </select>
      </div>

      <p className="mt-2 text-xs text-navy-text/50">
        {reorderEnabled
          ? "Use the arrows on each row to change a person's position. Order is reflected on the homepage and the Team page."
          : "Clear search and filters (All Roles / All statuses) to reorder people with the arrow controls."}
      </p>

      {/* List */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-gold/20 bg-white">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="font-serif text-lg font-bold text-navy-text">No people found</h3>
            <p className="mt-2 text-sm text-navy-text/60">Adjust your filters or add a new person.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gold/15">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-beige/30">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-beige">
                  {p.profilePhoto ? (
                    <img
                      src={resolveImageUrl(p.profilePhoto) || "/placeholder.svg"}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-navy-text">{p.fullName}</h3>
                    {p.featured ? <Star className="h-3.5 w-3.5 fill-gold text-gold" /> : null}
                    {p.showOnHomepage ? (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                        Homepage
                      </span>
                    ) : null}
                    {p.status !== "published" ? (
                      <span className="rounded-full bg-navy-text/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-text/60">
                        {p.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-navy-text/60">
                    {[p.jobTitle, p.companyName].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-navy-text/50">
                    {p.organizationName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 font-medium text-gold">
                        <Building2 className="h-3 w-3" />
                        {p.organizationName}
                      </span>
                    ) : (
                      <span className="italic text-navy-text/40">No organisation linked</span>
                    )}
                  </p>
                  {(p.roleTypes ?? []).length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(p.roleTypes ?? []).map((r) => (
                        <span
                          key={r}
                          className="rounded bg-navy-text px-1.5 py-0.5 text-[10px] font-medium text-white"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {reorderEnabled ? (
                    <div className="mr-1 flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleReorder(p.id, "up")}
                        disabled={isPending}
                        className="rounded p-0.5 text-navy-text/50 transition-colors hover:bg-beige hover:text-navy-text disabled:opacity-40"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(p.id, "down")}
                        disabled={isPending}
                        className="rounded p-0.5 text-navy-text/50 transition-colors hover:bg-beige hover:text-navy-text disabled:opacity-40"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-lg p-2 text-navy-text/60 transition-colors hover:bg-beige hover:text-navy-text"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
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
              <h2 className="font-serif text-xl font-bold text-navy-text">{editing ? "Edit Person" : "New Person"}</h2>
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
                <Label>Profile photo</Label>
                <ImageUpload
                  value={form.profilePhoto ?? ""}
                  onChange={(url) => setForm({ ...form, profilePhoto: url })}
                  hint="Recommended 600 × 600 px square head-and-shoulders portrait. PNG, JPG, or WebP. The full image is shown without cropping."
                />
              </div>

              <Field label="Full name" required>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Job title">
                  <Input value={form.jobTitle ?? ""} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
                </Field>
                <Field label="Country">
                  <Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </Field>
              </div>

              <Field label="Company name">
                <Input
                  value={form.companyName ?? ""}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </Field>

              <Field label="Organisation (linked member)">
                <select
                  value={form.organizationId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, organizationId: e.target.value ? Number(e.target.value) : null })
                  }
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-navy-text"
                >
                  <option value="">— Not linked to an organisation —</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-navy-text/50">
                  Links this person to a member organisation so they appear grouped under it on the public directory.
                </p>
              </Field>

              <div className="flex flex-col gap-2">
                <Label>Company logo</Label>
                <ImageUpload
                  value={form.companyLogo ?? ""}
                  onChange={(url) => setForm({ ...form, companyLogo: url })}
                  hint="Recommended 400 × 400 px. Use a transparent PNG (or WebP) for the cleanest look. The full logo is shown without cropping."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="LinkedIn URL">
                  <Input
                    value={form.linkedinUrl ?? ""}
                    onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </Field>
                <Field label="Email">
                  <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>

              <Field label="Short bio">
                <Textarea value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
              </Field>

              {/* Role types multi-select */}
              <div className="flex flex-col gap-2">
                <Label>Role types</Label>
                <p className="-mt-1 text-xs text-navy-text/55">A person can hold multiple roles.</p>
                <div className="flex flex-wrap gap-2">
                  {PEOPLE_ROLE_TYPES.map((role) => {
                    const active = (form.roleTypes ?? []).includes(role)
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => toggleRole(role)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "border-awaj-red bg-awaj-red text-white"
                            : "border-gold/40 bg-white text-navy-text/70 hover:border-gold"
                        }`}
                      >
                        {role}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Field label="Tags" hint="Comma-separated, e.g. Fintech, Web3, Investor">
                <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Fintech, Web3" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="h-9 rounded-md border border-input bg-white px-3 text-sm text-navy-text"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <Field label="Sort order">
                  <Input
                    type="number"
                    value={String(form.sortOrder ?? 0)}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  />
                </Field>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-gold/25 bg-white/60 p-4">
                <Toggle
                  label="Show on homepage (Ecosystem Leaders slider)"
                  checked={form.showOnHomepage ?? false}
                  onChange={(v) => setForm({ ...form, showOnHomepage: v })}
                />
                <Toggle
                  label="Featured (shown first)"
                  checked={form.featured ?? false}
                  onChange={(v) => setForm({ ...form, featured: v })}
                />
                <Toggle
                  label="Show company logo"
                  checked={form.showCompanyLogo ?? true}
                  onChange={(v) => setForm({ ...form, showCompanyLogo: v })}
                />
                <Toggle
                  label="Show LinkedIn link"
                  checked={form.showLinkedin ?? true}
                  onChange={(v) => setForm({ ...form, showLinkedin: v })}
                />
                <Toggle
                  label="Show role badge"
                  checked={form.showRoleBadge ?? false}
                  onChange={(v) => setForm({ ...form, showRoleBadge: v })}
                />
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
                  {isPending ? "Saving..." : editing ? "Save changes" : "Publish"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleChip({
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-awaj-red"
      />
      <span className="text-sm font-medium text-navy-text">{label}</span>
    </label>
  )
}
