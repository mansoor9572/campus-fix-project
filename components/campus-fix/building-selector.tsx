"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { searchBuildings, type BuildingEntry } from "@/lib/buildings/directory"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function BuildingSelector({ id, value, onChange, invalid }: {
  id: string; value: string; onChange: (building: BuildingEntry | null) => void; invalid?: boolean
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<BuildingEntry[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/buildings", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to load the building directory.")
      return response.json()
    }).then((data: BuildingEntry[]) => { setEntries(data); setError(""); setLoading(false) })
      .catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false) } })
    return () => controller.abort()
  }, [attempt])
  const selected = entries.find(entry => entry.id === value)
  const matches = searchBuildings(entries, query)
  const choose = (entry: BuildingEntry) => { onChange(entry); setQuery(entry.name); setOpen(false); setActive(-1) }
  return <div className="building-selector" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <div className="building-search-input">
      <Search aria-hidden="true" />
      <Input ref={inputRef} id={id} className="form-control" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid} aria-required="true" autoComplete="off" maxLength={160} value={query}
        placeholder={loading ? "Loading buildings..." : "Search building, code, or faculty"}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); onChange(null); setOpen(true); setActive(-1) }}
        onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); return }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true)
            setActive(index => matches.length ? Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))) : -1)
          }
          if (event.key === "Enter" && open) { event.preventDefault(); if (matches[active]) choose(matches[active]) }
        }} />
      {query && <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear building selection" onClick={() => { setQuery(""); onChange(null); setOpen(true); setActive(-1); inputRef.current?.focus() }}><X /></Button>}
    </div>
    {error && <div role="alert" className="building-load-error">{error} <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); setAttempt(n => n + 1) }}>Retry</Button></div>}
    {open && !loading && !error && <ul id={listId} role="listbox" aria-label="Matching buildings" className="building-results">
      {matches.map((entry, index) => <li id={`${listId}-${index}`} role="option" aria-selected={entry.id === value} key={entry.id}
        className={active === index ? "building-result-active" : ""}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(entry)}>
        <strong>{entry.name} {entry.code && <span className="building-code">{entry.code}</span>}</strong>
        <span>{entry.indonesianName}{entry.faculty ? ` · ${entry.faculty}` : entry.buildingType ? ` · ${entry.buildingType}` : ""}{entry.verificationStatus !== "verified" ? " · Details awaiting confirmation" : ""}</span>
      </li>)}
      {!matches.length && <li role="option" aria-disabled="true" aria-selected="false">No buildings match. Try a name, F6, Engineering, or Perpustakaan.</li>}
    </ul>}
    <span className="sr-only" role="status">{open && !loading ? `${matches.length} matching buildings` : ""}</span>
    {selected && <div className="selected-building">
      <strong>{selected.name}{selected.code ? ` (${selected.code})` : ""}</strong>
      {selected.verificationStatus === "verified" && <span>{selected.faculty || selected.buildingType}</span>}
      {selected.description && <span>{selected.description}</span>}
      {selected.mapsUrl && selected.verificationStatus === "verified" && <a href={selected.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}
    </div>}
  </div>
}
