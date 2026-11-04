"use client"

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  HardHat,
  ImagePlus,
  Info,
  MapPin,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Siren,
  UserRound,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useDemoData } from "@/components/campus-fix/demo-provider"
import {
  BrandMark,
  DemoBanner,
  EmptyState,
  PageHeader,
  PortalCard,
  PriorityBadge,
  ReportTable,
  ReportTimeline,
  RoleAvatar,
  StatCard,
  StatusBadge,
  formatDate,
} from "@/components/campus-fix/shared"
import {
  BUILDING_OPTIONS,
  CATEGORY_OPTIONS,
  DEPARTMENT_BY_CATEGORY,
  DEPARTMENT_OPTIONS,
  type CampusReport,
  type MaintenanceDepartment,
  type Priority,
  type ReportCategory,
  type ReportStatus,
  type Role,
} from "@/lib/campus-fix/data"

const allStatuses: ("All statuses" | ReportStatus)[] = ["All statuses", "Submitted", "Under Review", "In Progress", "Resolved", "Reopened", "Rejected"]
const allPriorities: ("All priorities" | Priority)[] = ["All priorities", "Urgent", "High", "Medium", "Low"]

function priorityRank(priority: Priority) {
  return ({ Urgent: 4, High: 3, Medium: 2, Low: 1 })[priority]
}

function queueOrder(reports: CampusReport[]) {
  return [...reports].sort((a, b) => {
    const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

export function AdminDashboard() {
  const { reports, profiles } = useDemoData()
  const [dateRange, setDateRange] = useState<"all" | "7" | "30">("all")
  const [loadedAt] = useState(() => Date.now())
  const cutoff = dateRange === "all" ? null : loadedAt - Number(dateRange) * 24 * 60 * 60 * 1000
  const periodReports = cutoff === null ? reports : reports.filter((report) => new Date(report.createdAt).getTime() >= cutoff)
  const openReports = periodReports.filter((report) => report.status !== "Resolved" && report.status !== "Rejected")
  const pendingCount = periodReports.filter((report) => report.status === "Submitted" || report.status === "Under Review").length
  const highPriorityCount = openReports.filter((report) => report.priority === "Urgent" || report.priority === "High").length
  const inProgressCount = periodReports.filter((report) => report.status === "In Progress").length
  const resolvedCount = periodReports.filter((report) => report.status === "Resolved").length
  const categories = CATEGORY_OPTIONS.map((category) => ({ category, count: periodReports.filter((report) => report.category === category).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
  const buildings = BUILDING_OPTIONS.map((building) => ({ building, count: periodReports.filter((report) => report.building === building).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxCategory = Math.max(1, ...categories.map((item) => item.count))
  const maxBuilding = Math.max(1, ...buildings.map((item) => item.count))
  const attentionQueue = queueOrder(openReports).slice(0, 5)
  const recentSubmissions = [...periodReports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
  const assignedOpenReports = openReports.filter((report) => report.assignedTo === profiles.staff.name)

  return (
    <>
      <PageHeader
        eyebrow="Campus operations"
        title="Operations overview"
        description={`Welcome back, ${profiles.admin.name.split(" ")[0]}. Here’s the campus service picture today.`}
        actions={(
          <div className="dashboard-header-actions">
            <label className="sr-only" htmlFor="admin-date-range">Filter dashboard by submission date</label>
            <select id="admin-date-range" className="filter-select" value={dateRange} onChange={(event) => setDateRange(event.target.value as "all" | "7" | "30")}>
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <Link className="button-link button-link-primary" href="/admin/reports">Review queue <ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      />
      <DemoBanner />
      <div className="stat-grid admin-stat-grid">
        <StatCard label="Total reports" value={periodReports.length} note="in selected period" icon={ClipboardCheck} />
        <StatCard label="Pending review" value={pendingCount} note="awaiting a decision" icon={Clock3} />
        <StatCard label="High priority" value={highPriorityCount} note="open urgent or high" icon={Siren} />
        <StatCard label="In progress" value={inProgressCount} note="assigned work" icon={Wrench} />
        <StatCard label="Resolved" value={resolvedCount} note="in selected period" icon={CheckCircle2} />
      </div>
      <div className="portal-grid">
        <PortalCard title="Needs attention" description="Open requests ordered by priority." className="portal-col-8" action={<Link className="card-link" href="/admin/reports">View all reports <ArrowRight aria-hidden="true" /></Link>} contentClassName="flush-card-content">
          {attentionQueue.length ? <ReportTable reports={attentionQueue} hrefFor={(report) => `/admin/reports/${report.id}`} showReporter /> : <EmptyState title="Queue is clear" description="New reports will appear here when they need a review." />}
        </PortalCard>
        <PortalCard title="Reports by category" description="A quick view of issue volume." className="portal-col-4" action={<span className="role-chip">{periodReports.length} total</span>}>
          <div className="distribution-list">
            {categories.map(({ category, count }) => (
              <div className="distribution-row" key={category}>
                <span className="distribution-label">{category}</span>
                <div className="distribution-track" role="progressbar" aria-label={`${category} reports`} aria-valuenow={count} aria-valuemin={0} aria-valuemax={maxCategory}>
                  <div className="distribution-fill" style={{ width: `${(count / maxCategory) * 100}%` }} />
                </div>
                <span className="distribution-count">{count}</span>
              </div>
            ))}
          </div>
        </PortalCard>
        <PortalCard title="Priority mix" description="Open reports by priority level." className="portal-col-5">
          <div className="priority-mix-list">
            {(["Urgent", "High", "Medium", "Low"] as Priority[]).map((priority) => {
              const count = openReports.filter((report) => report.priority === priority).length
              return <div className="priority-mix-row" key={priority}><PriorityBadge priority={priority} /><span>{count} active</span></div>
            })}
          </div>
          <div className="priority-mix-summary"><ShieldCheck aria-hidden="true" /><span>Every request has a visible owner and priority.</span></div>
        </PortalCard>
        <PortalCard title="Team workload" description="Assigned open work across the facilities team." className="portal-col-7" action={<span className="card-link">Demo team</span>}>
          <div className="workload-row">
            <RoleAvatar name={profiles.staff.name} role="staff" />
            <div className="workload-person"><strong>{profiles.staff.name}</strong><span>Facilities technician</span></div>
            <div className="workload-bar"><div style={{ width: `${Math.min(100, (assignedOpenReports.length / 5) * 100)}%` }} /></div>
            <span className="workload-count">{assignedOpenReports.length} open</span>
          </div>
          <div className="workload-note"><Info aria-hidden="true" /> Assign reports from the review queue to balance work across the team.</div>
        </PortalCard>
        <PortalCard title="Reports by building" description="Locations with the most requests." className="portal-col-4">
          <div className="distribution-list">
            {buildings.map(({ building, count }) => (
              <div className="distribution-row" key={building}>
                <span className="distribution-label">{building}</span>
                <div className="distribution-track" role="progressbar" aria-label={`${building} reports`} aria-valuenow={count} aria-valuemin={0} aria-valuemax={maxBuilding}>
                  <div className="distribution-fill" style={{ width: `${(count / maxBuilding) * 100}%` }} />
                </div>
                <span className="distribution-count">{count}</span>
              </div>
            ))}
          </div>
        </PortalCard>
        <PortalCard title="Recent submissions" description="Latest requests in the selected period." className="portal-col-8" contentClassName="flush-card-content">
          {recentSubmissions.length ? <ReportTable reports={recentSubmissions} hrefFor={(report) => `/admin/reports/${report.id}`} showReporter /> : <EmptyState title="No submissions in this period" description="Choose a wider date range to see older reports." />}
        </PortalCard>
      </div>
    </>
  )
}

function exportReports(reports: CampusReport[]) {
  const headers = ["Report ID", "Title", "Category", "Building", "Room", "Priority", "Status", "Reporter", "Assigned to", "Submitted"]
  const csvCell = (value: string | number | null) => {
    let str = String(value ?? "")
    if (/^[=+\-@\t\r]/.test(str)) str = "'" + str
    return `"${str.replaceAll('"', '""')}"`
  }
  const rows = reports.map((report) => [
    report.id,
    report.title,
    report.category,
    report.building,
    report.room,
    report.priority,
    report.status,
    report.reporterName,
    report.assignedTo ?? "Unassigned",
    formatDate(report.createdAt),
  ])
  const contents = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([`\uFEFF${contents}`], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "campusfix-reports.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminReports() {
  const { reports, profiles, searchTerm, setSearchTerm, changeReport } = useDemoData()
  const [query, setQuery] = useState(searchTerm)
  const [status, setStatus] = useState<(typeof allStatuses)[number]>("All statuses")
  const [priority, setPriority] = useState<(typeof allPriorities)[number]>("All priorities")
  const [category, setCategory] = useState<"All categories" | ReportCategory>("All categories")
  const [building, setBuilding] = useState("All buildings")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return queueOrder(reports).filter((report) => {
      const matchesStatus = status === "All statuses" || report.status === status
      const matchesPriority = priority === "All priorities" || report.priority === priority
      const matchesCategory = category === "All categories" || report.category === category
      const matchesBuilding = building === "All buildings" || report.building === building
      const matchesQuery = !normalized || `${report.id} ${report.title} ${report.building} ${report.room} ${report.reporterName} ${report.category}`.toLowerCase().includes(normalized)
      return matchesStatus && matchesPriority && matchesCategory && matchesBuilding && matchesQuery
    })
  }, [reports, query, status, priority, category, building])

  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => selected ? [...new Set([...current, id])] : current.filter((item) => item !== id))
  }

  const assignSelected = () => {
    if (!selectedIds.length) return
    selectedIds.forEach((id) => changeReport(id, { assignedTo: profiles.staff.name }, profiles.admin.name))
    toast.success(`${selectedIds.length} ${selectedIds.length === 1 ? "report" : "reports"} assigned to ${profiles.staff.name}.`)
    setSelectedIds([])
  }

  const startSelected = () => {
    if (!selectedIds.length) return
    selectedIds.forEach((id) => changeReport(id, { status: "In Progress" }, profiles.admin.name))
    toast.success(`${selectedIds.length} ${selectedIds.length === 1 ? "report" : "reports"} moved to In Progress.`)
    setSelectedIds([])
  }

  const clearFilters = () => {
    setQuery("")
    setStatus("All statuses")
    setPriority("All priorities")
    setCategory("All categories")
    setBuilding("All buildings")
    setSearchTerm("")
    setSelectedIds([])
  }

  return (
    <>
      <PageHeader
        eyebrow="Campus operations"
        title="All reports"
        description="Review, prioritize, and route requests from across campus."
        actions={<Button variant="outline" size="sm" onClick={() => exportReports(filteredReports)}><ArrowDownToLine data-icon="inline-start" aria-hidden="true" />Export CSV</Button>}
      />
      <DemoBanner>Review and assignment changes are shared across the admin and staff demo workspaces for this session.</DemoBanner>
      <Card className="portal-card">
        <CardHeader className="table-toolbar">
          <div className="table-filters">
            <label className="filter-input-wrap"><Search aria-hidden="true" /><input type="search" aria-label="Search all reports" value={query} onChange={(event) => { setQuery(event.target.value); setSearchTerm(event.target.value) }} placeholder="Search title, ID, location, reporter..." /></label>
            <label className="sr-only" htmlFor="admin-status-filter">Filter by status</label>
            <select id="admin-status-filter" className="filter-select" value={status} onChange={(event) => setStatus(event.target.value as (typeof allStatuses)[number])}>{allStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <label className="sr-only" htmlFor="admin-priority-filter">Filter by priority</label>
            <select id="admin-priority-filter" className="filter-select" value={priority} onChange={(event) => setPriority(event.target.value as (typeof allPriorities)[number])}>{allPriorities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <label className="sr-only" htmlFor="admin-category-filter">Filter by category</label>
            <select id="admin-category-filter" className="filter-select" value={category} onChange={(event) => setCategory(event.target.value as "All categories" | ReportCategory)}><option value="All categories">All categories</option>{CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <label className="sr-only" htmlFor="admin-building-filter">Filter by building</label>
            <select id="admin-building-filter" className="filter-select" value={building} onChange={(event) => setBuilding(event.target.value)}><option value="All buildings">All buildings</option>{BUILDING_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <span className="table-toolbar-count">{filteredReports.length} of {reports.length}</span>
        </CardHeader>
        {selectedIds.length ? (
          <div className="bulk-action-bar">
            <span><strong>{selectedIds.length}</strong> selected</span>
            <Button variant="outline" size="sm" onClick={assignSelected}><UserRound data-icon="inline-start" aria-hidden="true" />Assign to {profiles.staff.name.split(" ")[0]}</Button>
            <Button size="sm" onClick={startSelected}><Wrench data-icon="inline-start" aria-hidden="true" />Mark in progress</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Clear selection</Button>
          </div>
        ) : null}
        {filteredReports.length ? (
          <ReportTable
            reports={filteredReports}
            hrefFor={(report) => `/admin/reports/${report.id}`}
            showReporter
            selectable
            selectedIds={selectedIds}
            onToggle={toggleSelected}
          />
        ) : (
          <EmptyState title="No reports match these filters" description="Adjust the search or filters to see more requests." icon={Filter} action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
        )}
      </Card>
    </>
  )
}

export function AdminReportDetails({ reportId }: { reportId: string }) {
  const router = useRouter()
  const { reports, profiles, changeReport, addReportUpdate } = useDemoData()
  const report = reports.find((item) => item.id === reportId)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState("")
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [aiReviewStatus, setAiReviewStatus] = useState<string | null>(report?.aiAnalysis?.reviewStatus || null)
  const [reviewingAi, setReviewingAi] = useState(false)

  if (!report) {
    return <EmptyState title="Report not found" description="The request may have been removed or its ID may be incorrect." action={<Button variant="outline" onClick={() => router.push("/admin/reports")}>Back to all reports</Button>} />
  }

  const updateStatus = (status: ReportStatus) => {
    changeReport(report.id, { status }, profiles.admin.name)
    toast.success(`Status updated to ${status}.`)
  }

  const updatePriority = (priority: Priority) => {
    changeReport(report.id, { priority }, profiles.admin.name)
    toast.success(`Priority updated to ${priority}.`)
  }

  const assignTo = (staff: string) => {
    changeReport(report.id, { assignedTo: staff || null }, profiles.admin.name)
    toast.success(staff ? `Assigned to ${staff}.` : "Assignment removed.")
  }

  const submitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (note.trim().length < 4) {
      setNoteError("Add at least 4 characters to your note.")
      return
    }
    addReportUpdate(report.id, note.trim(), profiles.admin.name)
    setNote("")
    setNoteError("")
    toast.success("Team note added to the timeline.")
  }

  const escalate = () => {
    changeReport(report.id, { priority: "Urgent", status: report.status === "Submitted" ? "Under Review" : report.status }, profiles.admin.name)
    toast.success("Report escalated for immediate review.")
  }

  const approveReport = () => {
    changeReport(report.id, { status: "Under Review" }, profiles.admin.name)
    toast.success("Report approved and moved to the review queue.")
  }

  const rejectReport = () => {
    changeReport(report.id, { status: "Rejected" }, profiles.admin.name)
    addReportUpdate(report.id, "Campus Operations rejected this report after review.", profiles.admin.name, "Report rejected")
    setRejectDialogOpen(false)
    toast.success("Report rejected. The student will see this update in the demo.")
  }

  const updateCategory = (category: ReportCategory) => {
    changeReport(report.id, { category }, profiles.admin.name)
    toast.success(`Category updated to ${category}.`)
  }

  const updateDepartment = (department: MaintenanceDepartment) => {
    changeReport(report.id, { department }, profiles.admin.name)
    toast.success(`Routed to ${department}.`)
  }

  const suggestedDepartment = DEPARTMENT_BY_CATEGORY[report.category]
  const confidence = report.images.length ? 94 : 86

  const handleAiReview = async (action: "approved" | "rejected") => {
    setReviewingAi(true)
    try {
      const res = await fetch(`/api/reports/${report.id}/ai-analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed to update AI review.")
      setAiReviewStatus(action)
      toast.success(action === "approved" ? "AI suggestions approved." : "AI suggestions dismissed.")
    } catch {
      toast.error("Unable to update AI review status.")
    } finally {
      setReviewingAi(false)
    }
  }

  const applyAiSuggestions = () => {
    if (!report.aiAnalysis) return
    const ai = report.aiAnalysis
    const prioMap: Record<string, Priority> = { low: "Low", medium: "Medium", high: "High" }
    const mappedPriority = prioMap[ai.suggestedPriority] || report.priority
    changeReport(
      report.id,
      {
        category: (ai.suggestedCategory as ReportCategory) || report.category,
        priority: mappedPriority,
        department: (ai.recommendedDepartment as MaintenanceDepartment) || report.department,
      },
      profiles.admin.name
    )
    toast.success("Applied AI category, priority, and department recommendations.")
  }

  return (
    <>
      <PageHeader eyebrow="Campus operations" title="Review report" description={`Manage assignment, priority, and progress for ${report.id}.`} actions={<Link className="button-link button-link-secondary" href="/admin/reports">Back to all reports</Link>} />
      <DemoBanner>Changes made here appear in the student and staff demo workspaces.</DemoBanner>
      <div className="report-detail-grid">
        <div className="detail-main-column">
          <Card className="portal-card">
            <CardHeader className="portal-card-header">
              <div>
                <div className="report-detail-topline"><span className="table-id">{report.id}</span><StatusBadge status={report.status} /><PriorityBadge priority={report.priority} /></div>
                <h2 className="report-detail-title">{report.title}</h2>
                <div className="report-detail-meta">
                  <span><CalendarDays aria-hidden="true" />Submitted {formatDate(report.createdAt)}</span>
                  <span><MapPin aria-hidden="true" />{report.building} · {report.room}</span>
                  <span><Wrench aria-hidden="true" />{report.category}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="portal-card-content">
              <p className="report-description">{report.description}</p>
              {report.images.length ? <div className="report-photo-grid">{report.images.map((src, index) => <img key={`${report.id}-image-${index}`} src={src} alt={`Photo attached to ${report.id}`} />)}</div> : null}
              <div className="detail-summary-grid">
                <div><span className="report-detail-label">Reported by</span><span className="report-detail-value">{report.reporterName} · {report.reporterProgram}</span></div>
                <div><span className="report-detail-label">Contact</span><span className="report-detail-value">{report.reporterEmail}</span></div>
              </div>
            </CardContent>
          </Card>
          <PortalCard
            title={report.aiAnalysis ? `AI Triage & Classification` : `Demo AI analysis`}
            description={
              report.aiAnalysis
                ? `Powered by ${report.aiAnalysis.aiProvider} (${report.aiAnalysis.modelName})`
                : `Illustrative suggestions only. A human reviewer makes every final decision.`
            }
            className="ai-review-card"
          >
            <div className="ai-review-topline">
              <span className="ai-review-label">
                <Sparkles aria-hidden="true" />
                {report.aiAnalysis ? `${report.aiAnalysis.aiProvider}` : "Sample analysis"}
              </span>
              <span className="human-review-label">
                <ShieldCheck aria-hidden="true" />
                {aiReviewStatus === "approved"
                  ? "Approved by Admin"
                  : aiReviewStatus === "rejected"
                    ? "Dismissed"
                    : "Human review required"}
              </span>
            </div>
            <div className="ai-review-suggestions">
              <div>
                <span>Suggested category</span>
                <strong>{report.aiAnalysis?.suggestedCategory || report.category}</strong>
              </div>
              <div>
                <span>Suggested priority</span>
                <PriorityBadge
                  priority={
                    report.aiAnalysis
                      ? (({ low: "Low", medium: "Medium", high: "High" }[report.aiAnalysis.suggestedPriority] || "Medium") as Priority)
                      : report.priority
                  }
                />
              </div>
              <div>
                <span>Recommended department</span>
                <strong>{report.aiAnalysis?.recommendedDepartment || suggestedDepartment}</strong>
              </div>
            </div>
            {report.aiAnalysis?.detectedObject ? (
              <div style={{ marginTop: "12px", fontSize: "0.875rem" }}>
                <span className="report-detail-label">Detected Physical Fixture</span>
                <p style={{ fontWeight: 600, color: "#1f2937", marginTop: "2px" }}>{report.aiAnalysis.detectedObject}</p>
              </div>
            ) : null}
            <div className="ai-review-summary">
              <span>{report.aiAnalysis ? "Generated Problem Summary" : "Sample generated description"}</span>
              <p>{report.aiAnalysis?.problemSummary || report.aiAnalysis?.generatedDescription || report.description}</p>
            </div>
            <div className="ai-confidence">
              <div>
                <span>Confidence score</span>
                <strong>{Math.round((report.aiAnalysis?.confidence ?? confidence / 100) * 100)}%</strong>
              </div>
              <div
                className="ai-confidence-track"
                role="progressbar"
                aria-label="AI confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((report.aiAnalysis?.confidence ?? confidence / 100) * 100)}
              >
                <span style={{ width: `${Math.round((report.aiAnalysis?.confidence ?? confidence / 100) * 100)}%` }} />
              </div>
            </div>
            {report.aiAnalysis ? (
              <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <Button type="button" size="sm" variant="outline" onClick={applyAiSuggestions}>
                  <Sparkles data-icon="inline-start" aria-hidden="true" />
                  Apply suggestions
                </Button>
                {aiReviewStatus !== "approved" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleAiReview("approved")} disabled={reviewingAi}>
                    Approve triage
                  </Button>
                ) : null}
                {aiReviewStatus !== "rejected" ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleAiReview("rejected")} disabled={reviewingAi}>
                    Dismiss
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="ai-review-disclaimer"><Info aria-hidden="true" />This is demonstration content, not a real AI analysis.</p>
            )}
          </PortalCard>
          <PortalCard title="Activity timeline" description="Status changes and team notes." className="timeline-card">
            <ReportTimeline updates={report.updates} />
          </PortalCard>
          <Card className="portal-card comment-card">
            <CardHeader className="portal-card-header"><div><CardTitle>Add a team note</CardTitle><p>Notes are visible in the report timeline.</p></div><MessageSquareText aria-hidden="true" /></CardHeader>
            <CardContent className="portal-card-content">
              <form className="comment-form" onSubmit={submitNote}>
                <Field data-invalid={Boolean(noteError)}>
                  <FieldLabel htmlFor="admin-note">Team note</FieldLabel>
                  <Textarea id="admin-note" className="form-control" rows={3} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setNoteError("") }} placeholder="Add context for the student or facilities team..." aria-invalid={Boolean(noteError)} />
                  {noteError ? <FieldError>{noteError}</FieldError> : <FieldDescription>Keep updates clear and actionable.</FieldDescription>}
                </Field>
                <Button type="submit" size="sm"><MessageSquareText data-icon="inline-start" aria-hidden="true" />Add note</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="detail-side-column">
          <PortalCard title="Manage request" description="Update the team’s next step." className="details-actions-card">
            <div className="details-actions">
              <Field>
                <FieldLabel htmlFor="review-status">Status</FieldLabel>
                <select id="review-status" className="form-select" value={report.status} onChange={(event) => updateStatus(event.target.value as ReportStatus)}>
                  {allStatuses.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="review-category">Category</FieldLabel>
                <select id="review-category" className="form-select" value={report.category} onChange={(event) => updateCategory(event.target.value as ReportCategory)}>
                  {CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="review-priority">Priority</FieldLabel>
                <select id="review-priority" className="form-select" value={report.priority} onChange={(event) => updatePriority(event.target.value as Priority)}>
                  {(["Urgent", "High", "Medium", "Low"] as Priority[]).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="review-department">Department</FieldLabel>
                <select id="review-department" className="form-select" value={report.department ?? suggestedDepartment} onChange={(event) => updateDepartment(event.target.value as MaintenanceDepartment)}>
                  {DEPARTMENT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="review-assignee">Assigned to</FieldLabel>
                <select id="review-assignee" className="form-select" value={report.assignedTo ?? ""} onChange={(event) => assignTo(event.target.value)}>
                  <option value="">Unassigned</option>
                  <option value={profiles.staff.name}>{profiles.staff.name} · Facilities</option>
                  <option value={profiles.admin.name}>{profiles.admin.name} · Operations</option>
                </select>
              </Field>
              <Button variant="outline" className="full-width-button" onClick={escalate}><ShieldAlert data-icon="inline-start" aria-hidden="true" />Escalate priority</Button>
              <div className="review-decision-actions">
                <Button className="full-width-button" onClick={approveReport} disabled={report.status === "Rejected" || report.status === "Resolved"}><Check data-icon="inline-start" aria-hidden="true" />Approve report</Button>
                <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                  <AlertDialogTrigger render={<Button type="button" variant="outline" className="full-width-button reject-report-button" />}>Reject report</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject this report?</AlertDialogTitle>
                      <AlertDialogDescription>This adds a rejection update to the student&apos;s demo timeline and marks the request as rejected. This prototype change stays in memory only.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep report</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={rejectReport}>Reject report</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </PortalCard>
          <PortalCard title="Reporter" description="Person who submitted the request." className="reporter-card">
            <div className="team-contact-row"><RoleAvatar name={report.reporterName} role="student" /><div><strong>{report.reporterName}</strong><span>{report.reporterProgram}</span></div></div>
            <a className="reporter-email-link" href={`mailto:${report.reporterEmail}`}>{report.reporterEmail}</a>
          </PortalCard>
          <PortalCard title="Location" description="Campus site and room." className="detail-location-card">
            <div className="location-card-icon"><Building2 aria-hidden="true" /></div><strong>{report.building}</strong><span>{report.room}</span><span className="location-category"><MapPin aria-hidden="true" />{report.category}</span>
          </PortalCard>
        </div>
      </div>
    </>
  )
}

export function StaffDashboard() {
  const { reports, profiles, changeReport } = useDemoData()
  const profile = profiles.staff
  const assigned = reports.filter((report) => report.assignedTo === profile.name)
  const active = queueOrder(assigned.filter((report) => report.status !== "Resolved" && report.status !== "Rejected"))
  const urgent = active.filter((report) => report.priority === "Urgent" || report.priority === "High").length
  const resolved = assigned.filter((report) => report.status === "Resolved").length

  const startWork = (report: CampusReport) => {
    changeReport(report.id, { status: "In Progress" }, profile.name)
    toast.success(`Work started on ${report.id}.`)
  }

  const resolveWork = (report: CampusReport) => {
    changeReport(report.id, { status: "Resolved" }, profile.name)
    toast.success(`${report.id} marked as resolved.`)
  }

  return (
    <>
      <PageHeader eyebrow="Facilities team" title={`Good morning, ${profile.name.split(" ")[0]}`} description="Your assigned work and priority requests for campus." actions={<span className="role-chip"><HardHat aria-hidden="true" />On shift · Facilities</span>} />
      <DemoBanner>Task changes sync with the admin queue and student report timeline in this session.</DemoBanner>
      <div className="stat-grid">
        <StatCard label="Active tasks" value={active.length} note="assigned to you" icon={Wrench} />
        <StatCard label="High priority" value={urgent} note="needs timely action" icon={ShieldAlert} />
        <StatCard label="In progress" value={active.filter((report) => report.status === "In Progress").length} note="currently underway" icon={Clock3} />
        <StatCard label="Resolved" value={resolved} note="assigned requests" icon={CheckCircle2} />
      </div>
      <div className="portal-grid">
        <PortalCard title="My task list" description="Open work orders assigned to you." className="portal-col-8" action={<span className="role-chip">{active.length} active</span>}>
          {active.length ? (
            <div className="task-list">
              {active.map((report) => (
                <article className="task-row" key={report.id}>
                  <span className="task-icon"><Wrench aria-hidden="true" /></span>
                  <div>
                    <Link href={`/staff/tasks/${report.id}`}><h3>{report.title}</h3></Link>
                    <p>{report.id} · {report.building} · {report.room}</p>
                    <div className="task-row-meta"><PriorityBadge priority={report.priority} /><StatusBadge status={report.status} /></div>
                  </div>
                  <div className="task-row-actions">
                    <Link className="table-open-link" href={`/staff/tasks/${report.id}`} aria-label={`View task ${report.id}`}><ArrowRight aria-hidden="true" /></Link>
                    {report.status === "In Progress" ? <Button variant="outline" size="sm" onClick={() => resolveWork(report)}>Resolve</Button> : <Button size="sm" onClick={() => startWork(report)}>Start work</Button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No open tasks" description="New assignments from Campus Operations will appear here." icon={CheckCircle2} />}
        </PortalCard>
        <PortalCard title="Priority guide" description="A shared starting point for triage." className="portal-col-4">
          <div className="priority-guide-list">
            <div><PriorityBadge priority="Urgent" /><span>Immediate safety or service impact</span></div>
            <div><PriorityBadge priority="High" /><span>Time-sensitive, affects multiple people</span></div>
            <div><PriorityBadge priority="Medium" /><span>Needs attention during routine work</span></div>
            <div><PriorityBadge priority="Low" /><span>Can be planned into regular maintenance</span></div>
          </div>
          <div className="priority-mix-summary"><Info aria-hidden="true" /><span>Coordinate changes with Campus Operations when a request needs re-prioritizing.</span></div>
        </PortalCard>
        <PortalCard title="Completed work" description="Recently resolved assigned requests." className="portal-col-12" action={<Link className="card-link" href="/notifications">Team updates <ArrowRight aria-hidden="true" /></Link>}>
          {assigned.filter((report) => report.status === "Resolved").length ? (
            <div className="completed-work-list">
              {assigned.filter((report) => report.status === "Resolved").slice(0, 3).map((report) => (
                <div className="completed-work-row" key={report.id}><span className="completed-check"><Check aria-hidden="true" /></span><div><strong>{report.title}</strong><span>{report.id} · {report.building}</span></div><StatusBadge status={report.status} /></div>
              ))}
            </div>
          ) : <EmptyState title="No completed tasks yet" description="Completed work will be listed here." icon={CheckCircle2} />}
        </PortalCard>
      </div>
    </>
  )
}

export function StaffTaskDetails({ taskId }: { taskId: string }) {
  const router = useRouter()
  const { reports, profiles, changeReport, addReportUpdate } = useDemoData()
  const task = reports.find((report) => report.id === taskId)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState("")
  const [completionEvidence, setCompletionEvidence] = useState<{ name: string; src: string } | null>(null)
  const [evidenceError, setEvidenceError] = useState("")

  if (!task) {
    return <EmptyState title="Task not found" description="This work order may have been removed or the ID may be incorrect." action={<Button variant="outline" onClick={() => router.push("/staff/dashboard")}>Back to my tasks</Button>} />
  }

  const updateStatus = (status: ReportStatus) => {
    changeReport(task.id, { status }, profiles.staff.name)
    toast.success(`Task status changed to ${status}.`)
  }

  const submitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (note.trim().length < 4) {
      setNoteError("Add at least 4 characters to your work note.")
      return
    }
    addReportUpdate(task.id, note.trim(), profiles.staff.name)
    setNote("")
    setNoteError("")
    toast.success("Work note added.")
  }

  const selectEvidence = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setEvidenceError("Choose an image file to attach as completion evidence.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setEvidenceError("Choose an image smaller than 10 MB.")
      return
    }
    try {
      const src = await readImagePreview(file)
      setCompletionEvidence({ name: file.name, src })
      setEvidenceError("")
      toast.success("Completion photo added to this demo task.")
    } catch {
      setEvidenceError("This image could not be previewed. Try another file.")
    }
  }

  return (
    <>
      <PageHeader eyebrow="Facilities team" title="Task details" description={`Work order ${task.id} · ${task.building} · ${task.room}.`} actions={<Link className="button-link button-link-secondary" href="/staff/dashboard">Back to my tasks</Link>} />
      <DemoBanner>Work notes and status updates appear in the shared report timeline.</DemoBanner>
      <div className="report-detail-grid">
        <div className="detail-main-column">
          <Card className="portal-card">
            <CardHeader className="portal-card-header"><div><div className="report-detail-topline"><span className="table-id">{task.id}</span><StatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><h2 className="report-detail-title">{task.title}</h2><div className="report-detail-meta"><span><CalendarDays aria-hidden="true" />Submitted {formatDate(task.createdAt)}</span><span><MapPin aria-hidden="true" />{task.building} · {task.room}</span><span><Wrench aria-hidden="true" />{task.category}</span></div></div></CardHeader>
            <CardContent className="portal-card-content"><p className="report-description">{task.description}</p>{task.images.length ? <div className="report-photo-grid">{task.images.map((src, index) => <img key={`${task.id}-${index}`} src={src} alt={`Photo attached to ${task.id}`} />)}</div> : null}<div className="detail-summary-grid"><div><span className="report-detail-label">Reported by</span><span className="report-detail-value">{task.reporterName}</span></div><div><span className="report-detail-label">Assigned to</span><span className="report-detail-value">{task.assignedTo ?? "Unassigned"}</span></div></div></CardContent>
          </Card>
          <PortalCard title="Work history" description="Your updates and the original report." className="timeline-card"><ReportTimeline updates={task.updates} /></PortalCard>
          <Card className="portal-card comment-card"><CardHeader className="portal-card-header"><div><CardTitle>Add a work note</CardTitle><p>Share a progress note for the student and admin team.</p></div><MessageSquareText aria-hidden="true" /></CardHeader><CardContent className="portal-card-content"><form className="comment-form" onSubmit={submitNote}><Field data-invalid={Boolean(noteError)}><FieldLabel htmlFor="staff-note">Work note</FieldLabel><Textarea id="staff-note" className="form-control" rows={3} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setNoteError("") }} placeholder="What did you inspect or complete?" aria-invalid={Boolean(noteError)} />{noteError ? <FieldError>{noteError}</FieldError> : <FieldDescription>Keep the update clear and useful for the next handoff.</FieldDescription>}</Field><Button type="submit" size="sm"><MessageSquareText data-icon="inline-start" aria-hidden="true" />Add work note</Button></form></CardContent></Card>
        </div>
        <div className="detail-side-column">
          <PortalCard title="Update status" description="Move this task through the work queue." className="details-actions-card">
            <div className="details-actions"><StatusBadge status={task.status} />{task.status === "Rejected" ? <p className="task-status-note">This report has been rejected and is closed to maintenance work.</p> : <div className="task-status-actions">{task.status !== "In Progress" && task.status !== "Resolved" ? <Button className="full-width-button" onClick={() => updateStatus("In Progress")}><Wrench data-icon="inline-start" aria-hidden="true" />Start work</Button> : null}{task.status !== "Resolved" ? <Button variant="outline" className="full-width-button" onClick={() => updateStatus("Resolved")}><CheckCircle2 data-icon="inline-start" aria-hidden="true" />Mark completed</Button> : <Button variant="outline" className="full-width-button" onClick={() => updateStatus("Reopened")}>Reopen task</Button>}</div>}</div>
          </PortalCard>
          <PortalCard title="Completion evidence" description="Attach an optional photo from the repair." className="completion-evidence-card">
            <div className="evidence-upload">
              <label className="evidence-upload-label" htmlFor="completion-evidence-input">
                <ImagePlus aria-hidden="true" />
                <span>Choose a completion photo</span>
                <small>Image files up to 10 MB · demo only</small>
              </label>
              <input id="completion-evidence-input" className="sr-only" type="file" accept="image/*" onChange={selectEvidence} />
              {evidenceError ? <p className="evidence-error" role="alert">{evidenceError}</p> : null}
              {completionEvidence ? (
                <div className="evidence-preview">
                  <img src={completionEvidence.src} alt={`Completion evidence for ${task.id}`} />
                  <div><strong>{completionEvidence.name}</strong><Button type="button" variant="ghost" size="sm" onClick={() => setCompletionEvidence(null)}>Remove photo</Button></div>
                </div>
              ) : null}
            </div>
          </PortalCard>
          <PortalCard title="Request context" description="The original report details." className="request-context-card"><div className="team-contact-row"><RoleAvatar name={task.reporterName} role="student" /><div><strong>{task.reporterName}</strong><span>{task.reporterProgram}</span></div></div><div className="detail-side-divider" /><span className="report-detail-label">Location</span><span className="report-detail-value">{task.building} · {task.room}</span><span className="report-detail-label">Priority</span><PriorityBadge priority={task.priority} /></PortalCard>
        </div>
      </div>
    </>
  )
}

export function ProfilePage({ role }: { role: Role }) {
  const { profiles, updateProfile } = useDemoData()
  const profile = profiles[role]
  const [values, setValues] = useState(profile)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const updateValue = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
    setSaved(false)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (values.name.trim().length < 2) nextErrors.name = "Enter your name."
    if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = "Enter a valid email address."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    updateProfile(role, values)
    setSaved(true)
    toast.success("Profile updated for this demo session.")
  }

  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" description="Update the information shown in your CampusFix workspace." />
      <DemoBanner>Profile changes remain in this browser session only and reset when you refresh.</DemoBanner>
      <div className="profile-layout">
        <Card className="portal-card profile-summary-card"><CardContent className="portal-card-content profile-summary"><RoleAvatar name={profile.name} role={role} className="avatar-large" /><h2>{profile.name}</h2><p>{profile.roleLabel}</p><span className="role-chip">{role === "student" ? "Northfield University" : role === "admin" ? "Campus Operations" : "Facilities Services"}</span><div className="profile-detail-line">Member since October 2026 · Demo profile</div></CardContent></Card>
        <Card className="portal-card"><CardHeader className="portal-card-header"><div><CardTitle>Personal information</CardTitle><p>Keep your contact details up to date.</p></div><UserRound aria-hidden="true" /></CardHeader><CardContent className="portal-card-content"><form className="profile-form" onSubmit={submit} noValidate><FieldGroup className="form-two-column"><Field data-invalid={Boolean(errors.name)}><FieldLabel htmlFor="profile-name">Full name</FieldLabel><Input id="profile-name" className="form-control" value={values.name} onChange={(event) => updateValue("name", event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name ? <FieldError>{errors.name}</FieldError> : null}</Field><Field data-invalid={Boolean(errors.email)}><FieldLabel htmlFor="profile-email">Email address</FieldLabel><Input id="profile-email" className="form-control" type="email" value={values.email} onChange={(event) => updateValue("email", event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email ? <FieldError>{errors.email}</FieldError> : null}</Field><Field><FieldLabel htmlFor="profile-department">Program or team</FieldLabel><Input id="profile-department" className="form-control" value={values.department} onChange={(event) => updateValue("department", event.target.value)} /></Field><Field><FieldLabel htmlFor="profile-phone">Phone number</FieldLabel><Input id="profile-phone" className="form-control" type="tel" value={values.phone} onChange={(event) => updateValue("phone", event.target.value)} /></Field></FieldGroup><div className="form-actions"><span className="saved-note" role="status">{saved ? "Saved for this session" : ""}</span><Button type="submit"><Check data-icon="inline-start" aria-hidden="true" />Save changes</Button></div></form></CardContent></Card>
      </div>
    </>
  )
}

export function SettingsPage() {
  const { preferences, updatePreference } = useDemoData()
  const settings: { key: keyof typeof preferences; title: string; description: string }[] = [
    { key: "emailUpdates", title: "Email updates", description: "Get an email-style update when a report changes status. Demo only; no email is sent." },
    { key: "inAppNotifications", title: "In-app notifications", description: "Show status changes and team notes in the notifications center." },
    { key: "weeklyDigest", title: "Weekly campus digest", description: "Receive a weekly summary of the reports you follow. Demo preference only." },
    { key: "compactTables", title: "Compact report tables", description: "Use a denser table layout when scanning many requests." },
  ]

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Choose how CampusFix keeps you up to date." />
      <DemoBanner>These preferences are saved in memory for this session and reset on refresh.</DemoBanner>
      <div className="settings-grid">
        <PortalCard title="Notifications" description="Choose which updates you want to see." className="settings-card">
          <div className="settings-list">
            {settings.slice(0, 3).map(({ key, title, description }) => (
              <div className="settings-row" key={key}>
                <div className="settings-row-copy"><strong>{title}</strong><p>{description}</p></div>
                <Switch aria-label={title} checked={preferences[key]} onCheckedChange={(checked) => updatePreference(key, checked)} />
              </div>
            ))}
          </div>
        </PortalCard>
        <PortalCard title="Workspace" description="Tune the way reports appear in your workspace." className="settings-card">
          <div className="settings-list">
            {settings.slice(3).map(({ key, title, description }) => (
              <div className="settings-row" key={key}>
                <div className="settings-row-copy"><strong>{title}</strong><p>{description}</p></div>
                <Switch aria-label={title} checked={preferences[key]} onCheckedChange={(checked) => updatePreference(key, checked)} />
              </div>
            ))}
          </div>
          <div className="settings-note"><Info aria-hidden="true" /><span>Use password recovery to change your password. Report preferences remain a local preview.</span></div>
        </PortalCard>
      </div>
    </>
  )
}

function SystemPage({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <main className="system-page">
      <div className="system-card">
        <Link href="/" aria-label="CampusFix home"><BrandMark /></Link>
        <span className="system-code">{code}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="system-card-actions"><Link className="button-link button-link-primary" href="/">Go to home <ArrowRight aria-hidden="true" /></Link><Link className="button-link button-link-secondary" href="/login">Sign in</Link></div>
      </div>
    </main>
  )
}

export function AccessDeniedPage() {
  return <SystemPage code="403 · ACCESS RESTRICTED" title="This workspace isn’t available." description="Your account does not have permission to access this workspace. Contact your campus administrator if you need a different role." />
}

export function NotFoundPage() {
  return <SystemPage code="404 · PAGE NOT FOUND" title="We couldn’t find that page." description="The link may be broken, or the page may have moved. Head back to CampusFix and choose a workspace to continue." />
}
