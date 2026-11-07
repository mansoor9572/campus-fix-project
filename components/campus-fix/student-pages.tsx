"use client"

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FilePlus2,
  ImagePlus,
  Info,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useDemoData } from "@/components/campus-fix/demo-provider"
import {
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
  formatDateTime,
} from "@/components/campus-fix/shared"
import {
  BUILDING_OPTIONS,
  CATEGORY_OPTIONS,
  type CampusNotification,
  type CampusReport,
  type Priority,
  type ReportCategory,
  type ReportStatus,
  type Role,
} from "@/lib/campus-fix/data"

const statusOptions: ("All statuses" | ReportStatus)[] = [
  "All statuses",
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved",
  "Reopened",
  "Rejected",
]

function getStudentReports(reports: CampusReport[], email: string) {
  return reports.filter((report) => report.reporterEmail === email)
}

function sortNewest(reports: CampusReport[]) {
  return [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function ActivityFeed({ reports }: { reports: CampusReport[] }) {
  const activity = sortNewest(reports)
    .flatMap((report) => report.updates.map((update) => ({ report, update })))
    .sort((a, b) => new Date(b.update.createdAt).getTime() - new Date(a.update.createdAt).getTime())
    .slice(0, 4)

  return (
    <div className="activity-list">
      {activity.map(({ report, update }) => (
        <div className="activity-item" key={`${report.id}-${update.id}`}>
          <span className="activity-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div className="activity-copy">
            <strong>{update.title}</strong>
            <p>{report.title}</p>
            <span>{formatDateTime(update.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function StudentDashboard() {
  const { reports, profiles, stats } = useDemoData()
  const profile = profiles.student
  const myReports = sortNewest(getStudentReports(reports, profile.email))
  const totalCount = stats ? stats.total : myReports.length
  const pendingCount = stats ? stats.pending : myReports.filter((report) => report.status === "Submitted" || report.status === "Under Review").length
  const progressCount = stats ? stats.inProgress : myReports.filter((report) => report.status === "In Progress").length
  const resolvedCount = stats ? stats.resolved : myReports.filter((report) => report.status === "Resolved").length

  return (
    <>
      <PageHeader
        eyebrow="Student workspace"
        title={`Good morning, ${profile.name.split(" ")[0]}`}
        description="Here’s the latest on the campus issues you’ve reported."
        actions={<Link className="button-link button-link-primary" href="/student/reports/new"><Plus aria-hidden="true" />New report</Link>}
      />
      <DemoBanner />
      <div className="stat-grid">
        <StatCard label="Total reports" value={totalCount} note="all time" icon={FilePlus2} />
        <StatCard label="Pending review" value={pendingCount} note="awaiting team review" icon={Clock3} />
        <StatCard label="In progress" value={progressCount} note="being worked on" icon={Wrench} />
        <StatCard label="Resolved" value={resolvedCount} note="issues taken care of" icon={CheckCircle2} />
      </div>
      <div className="portal-grid">
        <PortalCard
          title="Recent reports"
          description="A quick look at your latest requests."
          className="portal-col-8"
          action={<Link className="card-link" href="/student/reports">View all <ArrowRight aria-hidden="true" /></Link>}
          contentClassName="flush-card-content"
        >
          {myReports.length ? (
            <ReportTable reports={myReports.slice(0, 4)} hrefFor={(report) => `/student/reports/${report.id}`} />
          ) : (
            <EmptyState title="No reports yet" description="When you submit a campus request, it will appear here." action={<Link className="button-link button-link-primary" href="/student/reports/new">Create your first report <ArrowRight aria-hidden="true" /></Link>} />
          )}
        </PortalCard>
        <PortalCard title="Recent activity" description="Updates from your campus team." className="portal-col-4" action={<Link className="card-link" href="/student/notifications">Notifications <ArrowRight aria-hidden="true" /></Link>}>
          {myReports.length ? <ActivityFeed reports={myReports} /> : <p className="settings-card-description">Your report updates will show here.</p>}
        </PortalCard>
        <PortalCard title="Priority distribution" description="How your reports are currently classified." className="portal-col-4">
          <div className="student-priority-list">
            {(["Urgent", "High", "Medium", "Low"] as Priority[]).map((priority) => {
              const count = stats?.byPriority
                ? stats.byPriority.find((p) => p.priority.toLowerCase() === priority.toLowerCase())?.count ?? 0
                : myReports.filter((report) => report.priority === priority).length
              const percentage = totalCount ? Math.round((count / totalCount) * 100) : 0
              return (
                <div className="student-priority-row" key={priority}>
                  <div className="student-priority-label"><PriorityBadge priority={priority} /><span>{count}</span></div>
                  <div className="student-priority-track" role="progressbar" aria-label={`${priority} priority reports`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div>
                </div>
              )
            })}
          </div>
        </PortalCard>
        <PortalCard title="Quick guide" description="What happens after you report an issue?" className="portal-col-8 guide-card">
          <div className="guide-steps">
            <div className="guide-step"><span>1</span><div><strong>Campus Operations reviews it</strong><p>Your report is checked and routed to the right team.</p></div></div>
            <div className="guide-step"><span>2</span><div><strong>A technician is assigned</strong><p>You’ll see an owner and progress notes as work begins.</p></div></div>
            <div className="guide-step"><span>3</span><div><strong>You get a resolution update</strong><p>Follow the timeline to see when the issue is complete.</p></div></div>
          </div>
        </PortalCard>
      </div>
    </>
  )
}

export function StudentReports() {
  const { reports, profiles, searchTerm, setSearchTerm } = useDemoData()
  const myReports = sortNewest(getStudentReports(reports, profiles.student.email))
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("All statuses")
  const [priority, setPriority] = useState<"All priorities" | Priority>("All priorities")
  const [query, setQuery] = useState(searchTerm)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return myReports.filter((report) => {
      const matchesStatus = status === "All statuses" || report.status === status
      const matchesPriority = priority === "All priorities" || report.priority === priority
      const matchesText = !normalized || `${report.id} ${report.title} ${report.building} ${report.room} ${report.category}`.toLowerCase().includes(normalized)
      return matchesStatus && matchesPriority && matchesText
    })
  }, [myReports, query, status, priority])

  return (
    <>
      <PageHeader
        eyebrow="Student workspace"
        title="My reports"
        description="Track the issues you’ve reported and follow every update."
        actions={<Link className="button-link button-link-primary" href="/student/reports/new"><Plus aria-hidden="true" />New report</Link>}
      />
      <DemoBanner />
      <Card className="portal-card">
        <CardHeader className="table-toolbar">
          <div className="table-filters">
            <label className="filter-input-wrap">
              <Search aria-hidden="true" />
              <input aria-label="Search my reports" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchTerm(event.target.value) }} placeholder="Search reports or locations..." />
            </label>
            <label className="sr-only" htmlFor="student-status-filter">Filter by status</label>
            <select id="student-status-filter" className="filter-select" value={status} onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}>
              {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="sr-only" htmlFor="student-priority-filter">Filter by priority</label>
            <select id="student-priority-filter" className="filter-select" value={priority} onChange={(event) => setPriority(event.target.value as "All priorities" | Priority)}>
              <option value="All priorities">All priorities</option>
              {(["Urgent", "High", "Medium", "Low"] as Priority[]).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <span className="table-toolbar-count">{filtered.length} {filtered.length === 1 ? "report" : "reports"}</span>
        </CardHeader>
        {filtered.length ? (
          <ReportTable reports={filtered} hrefFor={(report) => `/student/reports/${report.id}`} />
        ) : (
          <EmptyState
            title={myReports.length ? "No matching reports" : "No reports yet"}
            description={myReports.length ? "Try another search or status filter." : "Submit a request when you notice something on campus that needs attention."}
            icon={FilePlus2}
            action={myReports.length ? <Button variant="outline" onClick={() => { setQuery(""); setStatus("All statuses"); setPriority("All priorities"); setSearchTerm("") }}>Clear filters</Button> : <Link className="button-link button-link-primary" href="/student/reports/new">Create a report <ArrowRight aria-hidden="true" /></Link>}
          />
        )}
      </Card>
    </>
  )
}

type ReportFormValues = {
  title: string
  category: ReportCategory | ""
  building: string
  room: string
  description: string
  priority: Priority
}

const initialFormValues: ReportFormValues = {
  title: "",
  category: "",
  building: "",
  room: "",
  description: "",
  priority: "Medium",
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

function suggestedPriority(category: ReportCategory): Priority {
  if (category === "Safety" || category === "Electrical") return "High"
  if (category === "HVAC" || category === "IT & AV") return "Medium"
  return "Low"
}

export function NewStudentReport() {
  const router = useRouter()
  const { addReport } = useDemoData()
  const uploadRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<ReportFormValues>(initialFormValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [image, setImage] = useState<{ src: string; name: string; size: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiResult, setAiResult] = useState<{
    problemSummary: string
    detectedObject: string
    suggestedCategory: string
    suggestedPriority: string
    recommendedDepartment: string
    confidence: number
    aiProvider: string
    modelName: string
  } | null>(null)

  const updateValue = <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
    setAnalyzed(false)
  }

  const selectImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file such as JPG, PNG, or WebP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.")
      return
    }
    try {
      const src = await toDataUrl(file)
      setImage({ src, name: file.name, size: file.size })
    } catch {
      toast.error("We couldn’t preview that image. Try another file.")
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectImage(event.target.files?.[0])
    event.target.value = ""
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void selectImage(event.dataTransfer.files?.[0])
  }

  const analyze = async () => {
    if (!values.title.trim() && !values.description.trim()) {
      toast.info("Add a title or description before running AI triage.")
      return
    }
    setAnalyzing(true)
    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title || "Facility issue",
          description: values.description || values.title,
          building: values.building,
          room: values.room,
          image: image ? { base64: image.src, mimeType: "image/jpeg" } : undefined,
        }),
      })

      if (!res.ok) throw new Error("AI analysis request failed.")
      const data = await res.json()
      if (data.triage) {
        const triage = data.triage
        const prioMap: Record<string, Priority> = {
          low: "Low",
          medium: "Medium",
          high: "High",
        }
        setValues((current) => ({
          ...current,
          priority: prioMap[triage.suggestedPriority] || current.priority,
          category: (triage.suggestedCategory as ReportCategory) || current.category,
        }))
        setAiResult(triage)
        setAnalyzed(true)
        toast.success(`AI Triage: Suggested ${triage.suggestedCategory} (${triage.suggestedPriority} priority) with ${Math.round(triage.confidence * 100)}% confidence.`)
      }
    } catch {
      // Graceful fallback to client calculation
      if (values.category) {
        setValues((current) => ({ ...current, priority: suggestedPriority(current.category as ReportCategory) }))
      }
      setAnalyzed(true)
      toast.info("Triage complete. You can adjust the suggested priority.")
    } finally {
      setAnalyzing(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (values.title.trim().length < 8) nextErrors.title = "Use at least 8 characters to describe the issue."
    if (!values.category) nextErrors.category = "Choose a category."
    if (!values.building) nextErrors.building = "Choose a building."
    if (values.room.trim().length < 2) nextErrors.room = "Add a room or nearby location."
    if (values.description.trim().length < 20) nextErrors.description = "Add a little more detail (at least 20 characters)."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error("Review the highlighted fields before submitting.")
      return
    }

    setSubmitting(true)
    const id = addReport({
      title: values.title.trim(),
      category: values.category as ReportCategory,
      building: values.building,
      room: values.room.trim(),
      description: values.description.trim(),
      priority: values.priority,
      images: image ? [image.src] : [],
    })
    toast.success(`${id} was submitted to Campus Operations.`)
    router.push("/student/reports")
  }

  return (
    <>
      <PageHeader
        eyebrow="Student workspace"
        title="Report a campus issue"
        description="Share a few details so the right team can take a look."
        actions={<Link className="button-link button-link-secondary" href="/student/reports">Cancel</Link>}
      />
      <DemoBanner>Reports, uploaded photos, and status changes are session-only demo data.</DemoBanner>
      <Card className="portal-card form-card">
        <CardHeader className="portal-card-header">
          <div><CardTitle>Issue details</CardTitle><p>Fields marked with an asterisk are required.</p></div>
          <span className="role-chip">New request</span>
        </CardHeader>
        <CardContent className="portal-card-content">
          <form onSubmit={submit} noValidate>
            <div className="form-two-column">
              <Field data-invalid={Boolean(errors.title)} className="form-span-2">
                <FieldLabel htmlFor="report-title">What needs attention? <span aria-hidden="true">*</span></FieldLabel>
                <Input id="report-title" className="form-control" value={values.title} onChange={(event) => updateValue("title", event.target.value)} placeholder="e.g. Air conditioning is leaking in room A101" aria-invalid={Boolean(errors.title)} maxLength={120} />
                {errors.title ? <FieldError>{errors.title}</FieldError> : <FieldDescription>Keep it short and specific so your report is easy to scan.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.category)}>
                <FieldLabel htmlFor="report-category">Category <span aria-hidden="true">*</span></FieldLabel>
                <select id="report-category" className="form-select" value={values.category} onChange={(event) => updateValue("category", event.target.value as ReportCategory | "")} aria-invalid={Boolean(errors.category)}>
                  <option value="">Select a category</option>
                  {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                {errors.category ? <FieldError>{errors.category}</FieldError> : <FieldDescription>Choose the area that best describes the issue.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.building)}>
                <FieldLabel htmlFor="report-building">Building <span aria-hidden="true">*</span></FieldLabel>
                <select id="report-building" className="form-select" value={values.building} onChange={(event) => updateValue("building", event.target.value)} aria-invalid={Boolean(errors.building)}>
                  <option value="">Choose a building</option>
                  {BUILDING_OPTIONS.map((building) => <option key={building} value={building}>{building}</option>)}
                </select>
                {errors.building ? <FieldError>{errors.building}</FieldError> : <FieldDescription>Pick the closest campus building.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.room)}>
                <FieldLabel htmlFor="report-room">Room or nearby location <span aria-hidden="true">*</span></FieldLabel>
                <Input id="report-room" className="form-control" value={values.room} onChange={(event) => updateValue("room", event.target.value)} placeholder="Room number, floor, or landmark" aria-invalid={Boolean(errors.room)} maxLength={100} />
                {errors.room ? <FieldError>{errors.room}</FieldError> : <FieldDescription>For example, “A101” or “east stairwell, 2nd floor.”</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.description)} className="form-span-2">
                <FieldLabel htmlFor="report-description">Tell us a little more <span aria-hidden="true">*</span></FieldLabel>
                <Textarea id="report-description" className="form-control" value={values.description} onChange={(event) => updateValue("description", event.target.value)} placeholder="What happened? When did you notice it? Is there anything the team should know before arriving?" aria-invalid={Boolean(errors.description)} maxLength={1200} rows={5} />
                {errors.description ? <FieldError>{errors.description}</FieldError> : <FieldDescription>{values.description.length}/1200 characters · Include useful details, but avoid personal or sensitive information.</FieldDescription>}
              </Field>
            </div>

            <div className="form-section-heading"><ImagePlus aria-hidden="true" />Add a photo <span className="optional-label">Optional</span></div>
            <div
              className={`upload-dropzone${dragging ? " upload-dropzone-active" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
              onDrop={handleDrop}
            >
              <div>
                <span className="upload-icon"><ImagePlus aria-hidden="true" /></span>
                <strong>Drag a photo here, or browse files</strong>
                <p>JPG, PNG, or WebP · up to 5 MB</p>
                <input ref={uploadRef} id="report-image" className="file-input-hidden" type="file" accept="image/*" onChange={handleFileChange} aria-label="Upload an issue photo" />
                <Button type="button" variant="outline" size="sm" className="upload-browse" onClick={() => uploadRef.current?.click()}>Browse files</Button>
              </div>
            </div>
            {image ? (
              <div className="upload-preview">
                <img src={image.src} alt={`Preview of ${image.name}`} />
                <div className="upload-preview-caption">
                  <div><strong>{image.name}</strong><span>{(image.size / 1024 / 1024).toFixed(2)} MB · ready to attach</span></div>
                  <Button type="button" variant="ghost" size="icon-sm" className="upload-remove" aria-label="Remove uploaded photo" onClick={() => setImage(null)}><X /></Button>
                </div>
              </div>
            ) : null}

            <div className="form-section-heading"><Sparkles aria-hidden="true" />AI Priority & Triage</div>
            <div className="priority-control-row">
              <div className="priority-control-copy">
                <span className="priority-control-label">Suggested priority</span>
                {analyzed ? <PriorityBadge priority={values.priority} /> : <span className="unanalysed-label">Run AI triage to analyze title, description, and photo.</span>}
              </div>
              <div className="priority-control-actions">
                <select aria-label="Set report priority" className="form-select priority-select" value={values.priority} onChange={(event) => updateValue("priority", event.target.value as Priority)}>
                  {(["Low", "Medium", "High", "Urgent"] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={analyze} disabled={analyzing}>
                  {analyzing ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Sparkles data-icon="inline-start" aria-hidden="true" />}
                  {analyzing ? "Analyzing with Gemini..." : "Analyze issue"}
                </Button>
              </div>
            </div>
            {aiResult ? (
              <div className="ai-insight" style={{ borderColor: "rgba(37, 99, 235, 0.3)", backgroundColor: "rgba(239, 246, 255, 0.6)", padding: "12px", borderRadius: "8px" }}>
                <span className="ai-insight-icon" style={{ color: "#2563eb" }}><Sparkles aria-hidden="true" /></span>
                <div className="ai-insight-copy" style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{aiResult.aiProvider} ({aiResult.modelName})</strong>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", padding: "2px 8px", borderRadius: "9999px" }}>
                      {Math.round(aiResult.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p style={{ marginTop: "4px", fontSize: "0.875rem" }}>
                    Detected <strong>{aiResult.detectedObject}</strong>. Suggested category: <strong>{aiResult.suggestedCategory}</strong> &bull; Recommended team: <strong>{aiResult.recommendedDepartment}</strong>.
                  </p>
                  {aiResult.problemSummary ? (
                    <p style={{ marginTop: "4px", fontStyle: "italic", fontSize: "0.85rem", color: "#4b5563" }}>
                      &ldquo;{aiResult.problemSummary}&rdquo;
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="ai-insight">
                <span className="ai-insight-icon"><Info aria-hidden="true" /></span>
                <div className="ai-insight-copy">
                  <strong>AI Facility Triage</strong>
                  <p>Click &ldquo;Analyze issue&rdquo; to have Google Gemini evaluate your title, description, and photo to automatically suggest the category, priority, and maintenance department.</p>
                </div>
              </div>
            )}

            <div className="form-actions">
              <span className="required-note">* Required fields</span>
              <div className="form-action-buttons">
                <Link className="button-link button-link-secondary" href="/student/reports">Cancel</Link>
                <Button type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <FilePlus2 data-icon="inline-start" aria-hidden="true" />}Submit report <ArrowRight data-icon="inline-end" /></Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export function StudentReportDetails({ reportId }: { reportId: string }) {
  const router = useRouter()
  const { reports, profiles, addReportUpdate } = useDemoData()
  const report = reports.find((item) => item.id === reportId)
  const [comment, setComment] = useState("")
  const [commentError, setCommentError] = useState("")

  if (!report) {
    return <EmptyState title="Report not found" description="This report may have been removed or the ID may be incorrect." action={<Button variant="outline" onClick={() => router.push("/student/reports")}>Back to my reports</Button>} />
  }

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (comment.trim().length < 4) {
      setCommentError("Add at least 4 characters to your follow-up.")
      return
    }
    addReportUpdate(report.id, comment.trim(), profiles.student.name, "Student follow-up added")
    setComment("")
    setCommentError("")
    toast.success("Your follow-up was added to the report timeline.")
  }

  return (
    <>
      <PageHeader eyebrow="Student workspace" title="Report details" description={`Follow the progress on ${report.id}.`} actions={<Link className="button-link button-link-secondary" href="/student/reports">Back to my reports</Link>} />
      <DemoBanner />
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
              {report.images.length ? (
                <div className="report-photo-grid">
                  {report.images.map((src, index) => <img key={`${report.id}-image-${index}`} src={src} alt={`Photo attached to ${report.id}`} />)}
                </div>
              ) : null}
              <div className="detail-summary-grid">
                <div><span className="report-detail-label">Reported by</span><span className="report-detail-value">{report.reporterName}</span></div>
                <div><span className="report-detail-label">Assigned to</span><span className="report-detail-value">{report.assignedTo ?? "Not assigned yet"}</span></div>
              </div>
              {report.aiAnalysis ? (
                <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles style={{ width: "16px", height: "16px", color: "#16a34a" }} aria-hidden="true" />
                    <span><strong>AI Triage:</strong> Identified as <em>{report.aiAnalysis.detectedObject}</em> ({report.aiAnalysis.suggestedCategory})</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>{Math.round(report.aiAnalysis.confidence * 100)}% confidence</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <PortalCard title="Progress timeline" description="Updates from your report and the campus team." className="timeline-card">
            <ReportTimeline updates={report.updates} />
          </PortalCard>
          <Card className="portal-card comment-card">
            <CardHeader className="portal-card-header"><div><CardTitle>Add a follow-up</CardTitle><p>Share a helpful detail with the campus team.</p></div><MessageSquareText aria-hidden="true" /></CardHeader>
            <CardContent className="portal-card-content">
              <form onSubmit={submitComment} className="comment-form">
                <Field data-invalid={Boolean(commentError)}>
                  <FieldLabel htmlFor="report-comment">Comment</FieldLabel>
                  <Textarea id="report-comment" className="form-control" value={comment} onChange={(event) => { setComment(event.target.value); setCommentError("") }} maxLength={500} rows={3} placeholder="Add a detail that may help the team..." aria-invalid={Boolean(commentError)} />
                  {commentError ? <FieldError>{commentError}</FieldError> : <FieldDescription>Comments are part of this session-only demo.</FieldDescription>}
                </Field>
                <Button type="submit" size="sm"><MessageSquareText data-icon="inline-start" aria-hidden="true" />Add comment</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="detail-side-column">
          <PortalCard title="Request status" description={`Last updated ${formatDate(report.updatedAt)}`} className="detail-status-card">
            <div className="status-summary"><StatusBadge status={report.status} /><span className="status-summary-note">{report.status === "Resolved" ? "This issue has been marked as resolved." : "Campus Operations is tracking this request."}</span></div>
            <div className="detail-side-divider" />
            <div className="team-contact-row"><RoleAvatar name="Dana Brooks" role="admin" /><div><strong>Campus Operations</strong><span>Review and coordination</span></div></div>
            {report.assignedTo ? <div className="team-contact-row"><RoleAvatar name={report.assignedTo} role="staff" /><div><strong>{report.assignedTo}</strong><span>Assigned facilities technician</span></div></div> : null}
            <Link className="button-link button-link-secondary full-width-button" href="/student/notifications"><Bell aria-hidden="true" />View notifications</Link>
          </PortalCard>
          <PortalCard title="Resolution evidence" description="Photos from completed maintenance work." className="resolution-evidence-card">
            <div className="resolution-evidence-placeholder">
              <span><ImagePlus aria-hidden="true" /></span>
              <p>{report.status === "Resolved" ? "No completion photo is attached to this demo report yet." : "Completion photos will appear here once the campus team marks this request complete."}</p>
            </div>
          </PortalCard>
          <PortalCard title="Location" description="Where the issue was reported." className="detail-location-card">
            <div className="location-card-icon"><Building2 aria-hidden="true" /></div>
            <strong>{report.building}</strong>
            <span>{report.room}</span>
            <span className="location-category"><MapPin aria-hidden="true" />{report.category}</span>
          </PortalCard>
        </div>
      </div>
    </>
  )
}

function NotificationItem({ notification, role }: { notification: CampusNotification; role: Role }) {
  const { markNotificationRead } = useDemoData()
  const reportBase = role === "admin" ? "/admin/reports" : role === "staff" ? "/staff/tasks" : "/student/reports"
  const href = notification.reportId ? `${reportBase}/${notification.reportId}` : "/notifications"
  return (
    <article className={`notification-card${notification.read ? "" : " notification-card-unread"}`}>
      <span className="notification-icon">{notification.type === "status" ? <CheckCircle2 aria-hidden="true" /> : <Bell aria-hidden="true" />}</span>
      <div className="notification-copy">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
        <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
      </div>
      <div className="notification-actions">
        {!notification.read ? <span className="notification-unread-dot" aria-label="Unread" /> : null}
        {notification.reportId ? <Link className="table-open-link" href={href} aria-label="Open related report"><ChevronRight aria-hidden="true" /></Link> : null}
        {!notification.read ? <Button variant="ghost" size="sm" onClick={() => markNotificationRead(notification.id)}>Mark read</Button> : null}
      </div>
    </article>
  )
}

export function NotificationsPage({ role }: { role: Role }) {
  const { notifications, markAllNotificationsRead } = useDemoData()
  const unread = notifications.filter((notification) => !notification.read).length
  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <>
      <PageHeader
        eyebrow="Your workspace"
        title="Notifications"
        description={unread ? `You have ${unread} unread ${unread === 1 ? "update" : "updates"}.` : "You’re all caught up. Here are your recent updates."}
        actions={unread ? <Button variant="outline" size="sm" onClick={markAllNotificationsRead}><CheckCheck data-icon="inline-start" aria-hidden="true" />Mark all as read</Button> : undefined}
      />
      <DemoBanner />
      <div className="notification-list">
        {sorted.length ? sorted.map((notification) => <NotificationItem key={notification.id} notification={notification} role={role} />) : <EmptyState title="No notifications yet" description="Status changes and team updates will appear here." icon={Bell} />}
      </div>
    </>
  )
}
