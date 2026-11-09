"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { CampusReport } from "@/lib/campus-fix/data"
import type { TeamDirectory } from "./team-management"
import { useDemoData } from "./demo-provider"

export function AssignmentPanel({ report }: { report: CampusReport }) {
  const { changeReport } = useDemoData()
  const [directory, setDirectory] = useState<TeamDirectory | null>(null)
  const [departmentId, setDepartmentId] = useState(report.departmentId ?? "")
  const [workerId, setWorkerId] = useState(report.assignedStaffId ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetch("/api/admin/team", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to load available workers.")
      return response.json()
    }).then(data => { if (active) setDirectory(data) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [attempt])
  const workers = directory?.members.filter(member => member.role === "maintenance_staff" && member.isActive && member.departmentId === departmentId) ?? []
  const closed = ["Resolved", "Closed", "Rejected"].includes(report.status)
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    const saved = await changeReport(report.id, { departmentId, assignedStaffId: workerId || null })
    if (saved) toast.success(workerId ? "Work assigned. The worker has been notified." : "Department saved. Report is unassigned.")
    setBusy(false)
  }
  return <form className="team-form" onSubmit={assign}>
    <label>Responsible department<select aria-label="Responsible department" className="form-select" value={departmentId} required disabled={busy || closed} onChange={event => { setDepartmentId(event.target.value); setWorkerId("") }}>
      <option value="" disabled>Select department</option>{directory?.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
    </select></label>
    <label>Assign worker<select aria-label="Assign worker" className="form-select" value={workerId} disabled={busy || closed || !departmentId} onChange={event => setWorkerId(event.target.value)}>
      <option value="">Unassigned</option>{workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name} · {worker.email} · {worker.openTasks} open tasks</option>)}
    </select></label>
    {error && <p role="alert">{error} <Button type="button" variant="outline" onClick={() => { setError(""); setAttempt(value => value + 1) }}>Retry</Button></p>}
    {!directory && !error && <p role="status">Loading workers…</p>}
    {directory && departmentId && !workers.length && <p>No active workers in this department. <Link href="/admin/team">Add worker</Link>, or save it as unassigned.</p>}
    {closed ? <p>Reopen this report before assigning work.</p> : <Button type="submit" disabled={busy || !directory || !departmentId}>{busy ? "Saving…" : workerId ? "Assign work" : "Save department"}</Button>}
  </form>
}
