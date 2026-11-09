"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { PageHeader, PortalCard } from "./shared"

export type TeamMember = { id: string; name: string; email: string; role: "admin" | "maintenance_staff";
  isActive: boolean; departmentId: string | null; departmentName: string | null; mustChangePassword: boolean; openTasks: number }
export type TeamDirectory = { members: TeamMember[]; departments: Array<{ id: string; name: string }> }

function generatedPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
}

async function fetchDirectory(): Promise<TeamDirectory> {
  const response = await fetch("/api/admin/team", { cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || "Unable to load the team.")
  return result
}

export function TeamManagementPage() {
  const { data: session } = useSession()
  const [directory, setDirectory] = useState<TeamDirectory | null>(null)
  const [tab, setTab] = useState<"maintenance_staff" | "admin">("maintenance_staff")
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [query, setQuery] = useState("")
  const load = useCallback(async () => {
    setDirectory(await fetchDirectory())
  }, [])
  useEffect(() => {
    let mounted = true
    void fetchDirectory().then(data => { if (mounted) setDirectory(data) }).catch(error => { if (mounted) setError(error.message) })
    return () => { mounted = false }
  }, [])

  async function save(path: string, method: string, body: unknown, credentialEmail?: string) {
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to save account.")
      if (credentialEmail) setCredentials({ email: credentialEmail, password })
      setPassword(""); setShowPassword(false); setCreating(false); setSelected(null); setMessage(result.message)
      await load()
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again.") }
    finally { setBusy(false) }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email"))
    void save("/api/admin/team", "POST", { name: form.get("name"), email, password, role: tab,
      departmentId: tab === "maintenance_staff" ? form.get("departmentId") : null }, email)
  }
  function chooseTab(role: typeof tab) { setTab(role); setCreating(false); setSelected(null); setPassword(""); setError("") }
  const members = directory?.members.filter(member => member.role === tab && `${member.name} ${member.email} ${member.departmentName ?? ""}`.toLowerCase().includes(query.toLowerCase())) ?? []
  const passwordField = <label>Temporary password
    <input aria-label="Temporary password" className="form-control" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
    <span className="team-actions"><Button type="button" variant="outline" size="sm" onClick={() => { setPassword(generatedPassword()); setShowPassword(true) }}>Generate password</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"} password</Button></span>
    <small>At least 12 characters. The account holder must change it at first login.</small>
  </label>

  return <>
    <PageHeader eyebrow="Campus operations" title="Team management" description="Create accounts, organize workers by department, and manage access."
      actions={<Button disabled={!directory || busy} onClick={() => { setCreating(true); setSelected(null); setPassword(""); setError("") }}>Add {tab === "admin" ? "administrator" : "worker"}</Button>} />
    <div className="team-actions" role="group" aria-label="Account type">
      <Button variant={tab === "maintenance_staff" ? "default" : "outline"} aria-pressed={tab === "maintenance_staff"} onClick={() => chooseTab("maintenance_staff")}>Workers</Button>
      <Button variant={tab === "admin" ? "default" : "outline"} aria-pressed={tab === "admin"} onClick={() => chooseTab("admin")}>Administrators</Button>
    </div>
    {error && <div className="team-feedback" role="alert">{error}<Button variant="outline" size="sm" onClick={() => { setError(""); void load().catch(error => setError(error.message)) }}>Reload team</Button></div>}
    {message && <p className="team-feedback" role="status">{message}</p>}
    {credentials && <PortalCard title="Account sign-in details" description="Copy these details now and share them privately with the account holder. The password will not be available again after dismissing this message.">
      <p>Email: <strong>{credentials.email}</strong></p><p>Temporary password: <code className="team-password-value">{credentials.password}</code></p>
      <Button variant="outline" onClick={() => setCredentials(null)}>Dismiss sign-in details</Button>
    </PortalCard>}
    {creating && <PortalCard title={tab === "admin" ? "New administrator" : "New worker"}>
      <form className="team-form" onSubmit={create}>
        <label>Full name<input name="name" className="form-control" minLength={2} maxLength={100} required /></label>
        <label>Email address<input name="email" type="email" className="form-control" maxLength={254} required /></label>
        {tab === "maintenance_staff" && <label>Department<select aria-label="Department" name="departmentId" className="form-select" defaultValue="" required><option value="" disabled>Select department</option>{directory?.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>}
        {passwordField}
        {tab === "admin" && <label className="team-confirm"><input type="checkbox" required />I understand this account can manage reports, workers, and other administrators.</label>}
        <div className="team-actions"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create account"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setCreating(false); setPassword("") }}>Cancel</Button></div>
      </form>
    </PortalCard>}
    {selected && <PortalCard title={`Manage ${selected.name}`} description={selected.email}>
      <div className="team-form">
        {selected.role === "maintenance_staff" && <form className="team-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void save(`/api/admin/team/${selected.id}`, "PATCH", { departmentId: data.get("departmentId") }) }}>
          <label>Department<select aria-label="Department" className="form-select" name="departmentId" defaultValue={selected.departmentId ?? ""} required><option value="" disabled>Select department</option>{directory?.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
          <Button disabled={busy || selected.openTasks > 0}>Save department</Button>
          {selected.openTasks > 0 && <p>Reassign all {selected.openTasks} unfinished tasks before changing the department or deactivating this worker.</p>}
        </form>}
        <form className="team-form" onSubmit={event => { event.preventDefault(); void save(`/api/admin/team/${selected.id}`, "PATCH", { password }, selected.email) }}>{passwordField}<Button type="submit" variant="outline" disabled={busy}>Reset temporary password</Button></form>
        <div className="team-actions"><Button variant="outline" disabled={busy || (selected.isActive && selected.openTasks > 0)} onClick={() => {
          if (!selected.isActive || window.confirm(`Deactivate ${selected.name}? They will be signed out and unable to log in.`)) void save(`/api/admin/team/${selected.id}`, "PATCH", { isActive: !selected.isActive })
        }}>{selected.isActive ? "Deactivate account" : "Reactivate account"}</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); setPassword("") }}>Close</Button></div>
      </div>
    </PortalCard>}
    <PortalCard title={tab === "admin" ? "Administrators" : "Workers"} description="Inactive accounts retain their work history.">
      <label>Search team<input className="form-control" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, or department" /></label>
      {!directory ? <p role="status">Loading team…</p> : !members.length ? <p>No matching accounts.</p> : <div className="team-member-list">{members.map(member => <article className="team-member" key={member.id}>
        <div><strong>{member.name}</strong><p>{member.email}</p><p>{member.role === "maintenance_staff" ? `${member.departmentName ?? "Department required"} · ${member.openTasks} open tasks` : "Administrator"}</p>
          <small>{member.isActive ? "Active" : "Inactive"}{member.mustChangePassword ? " · Password change required" : ""}</small></div>
        <Button variant="outline" disabled={busy || member.id === session?.user.id} aria-label={`Manage ${member.email}`} onClick={() => { setSelected(member); setCreating(false); setPassword(""); setError("") }}>{member.id === session?.user.id ? "Your account" : "Manage"}</Button>
      </article>)}</div>}
    </PortalCard>
  </>
}
