"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader, PortalCard } from "./shared"
import { searchBuildings, type BuildingEntry } from "@/lib/buildings/directory"

export function BuildingDirectoryPage() {
  const [entries, setEntries] = useState<BuildingEntry[]>([])
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<BuildingEntry | "new" | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/buildings?all=true", { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error("Unable to load the directory.")
      return res.json()
    }).then(data => { setEntries(data); setLoading(false) }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false) } })
    return () => controller.abort()
  }, [])
  const current = editing && editing !== "new" ? editing : null
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setPending(true)
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form.entries())
    const payload = { ...values, aliases: String(values.aliases || "").split("\n").map(value => value.trim()).filter(Boolean),
      latitude: values.latitude ? Number(values.latitude) : null, longitude: values.longitude ? Number(values.longitude) : null,
      isActive: form.has("isActive") }
    try {
      const response = await fetch(current ? `/api/buildings/${current.id}` : "/api/buildings", {
        method: current ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to save building.")
      setEntries(rows => current ? rows.map(row => row.id === result.id ? result : row) : [...rows, result])
      setEditing(null); setMessage("Building saved. Students will see the updated directory when they open a new report.")
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save building.") }
    finally { setPending(false) }
  }
  const matches = searchBuildings(entries, query)
  return <>
    <PageHeader eyebrow="Campus operations" title="UMY building directory" description="Maintain building names, search aliases, and verified location information." actions={<Button onClick={() => { setEditing("new"); setError(""); setMessage("") }}>Add building</Button>} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {editing && <PortalCard title={current ? "Edit building" : "Add building"} description="Only mark information verified after checking an authoritative source.">
      <form key={current?.id || "new"} onSubmit={save} className="directory-edit-form">
        <div className="form-two-column">
          {([
            ["name", "English / display name", 160, true], ["indonesianName", "Indonesian name", 160, false],
            ["code", "Building code (if known)", 30, false], ["faculty", "Faculty / department association", 160, false],
            ["buildingType", "Building type", 80, false], ["mapsUrl", "Google Maps link", 1000, false],
            ["sourceUrl", "Authoritative source URL", 1000, false],
          ] as const).map(([name, label, maxLength, required]) => <label key={name}>{label}<Input className="form-control" name={name} defaultValue={current?.[name] || ""} required={required} maxLength={maxLength} type={name.endsWith("Url") ? "url" : "text"} /></label>)}
          <label>Verification status<select name="verificationStatus" className="form-select" defaultValue={current?.verificationStatus || "unverified"}><option value="unverified">Unverified — awaiting confirmation</option><option value="verified">Verified — authoritative source checked</option><option value="historical">Historical — older directory</option></select></label>
          <label>Latitude (verified only)<Input className="form-control" name="latitude" type="number" step="any" min={-90} max={90} defaultValue={current?.latitude ?? ""} /></label>
          <label>Longitude (verified only)<Input className="form-control" name="longitude" type="number" step="any" min={-180} max={180} defaultValue={current?.longitude ?? ""} /></label>
          <label className="form-span-2">Alternative names (one per line; up to 30)<Textarea className="form-control" name="aliases" rows={3} maxLength={3630} defaultValue={current?.aliases.join("\n") || ""} /></label>
          <label className="form-span-2">Location description<Textarea className="form-control" name="description" rows={3} maxLength={1000} defaultValue={current?.description || ""} /></label>
        </div>
        <label><input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} /> Active and available for new reports</label>
        <div className="directory-actions"><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save building"}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button></div>
      </form>
    </PortalCard>}
    <PortalCard title="Directory entries" description="Unverified and historical entries need facilities confirmation. Deactivation preserves existing reports.">
      <Input className="form-control" aria-label="Search building directory" placeholder="Search name, code, faculty, or alias" value={query} onChange={event => setQuery(event.target.value)} maxLength={160} />
      <div className="directory-entries">
        {matches.map(entry => <article key={entry.id}>
          <div><strong>{entry.name} {entry.code && <span className="building-code">{entry.code}</span>}</strong><p>{entry.indonesianName}{entry.faculty ? ` · ${entry.faculty}` : ""}</p><span className="directory-status">{entry.verificationStatus} · {entry.isActive ? "Active" : "Inactive"}</span></div>
          <Button variant="outline" onClick={() => { setEditing(entry); setError(""); setMessage("") }} aria-label={`Edit ${entry.name}`}>Edit</Button>
        </article>)}
        {!entries.length && <p>{loading ? "Loading directory..." : "No directory entries loaded. Add a building or seed the initial UMY directory."}</p>}
        {entries.length > 0 && !matches.length && <p>No buildings match this search.</p>}
      </div>
    </PortalCard>
  </>
}
