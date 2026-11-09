"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Camera,
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
  RefreshCw,
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
import { BuildingSelector } from "./building-selector"
import { ReportDescriptionField } from "./report-description-field"
import { REPORT_TEXT_MAX, REPORT_TEXT_MIN, titleFromDescription } from "@/lib/reports/text"
import { LOCATION_LIMITS, locationSummary } from "@/lib/reports/location"
import {
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
  "Approved",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
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
      const matchesText = !normalized || `${report.id} ${report.title} ${report.building} ${locationSummary(report)} ${report.category}`.toLowerCase().includes(normalized)
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
  category: ReportCategory | ""
  building: string
  buildingId: string
  floor: string
  roomNumber: string
  description: string
  priority: Priority
}

const initialFormValues: ReportFormValues = {
  category: "",
  building: "",
  buildingId: "",
  floor: "",
  roomNumber: "",
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
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment")
  const [values, setValues] = useState<ReportFormValues>(initialFormValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [image, setImage] = useState<{ src: string; name: string; size: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream
      setCameraFacing(facing)
      setCameraActive(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch (err) {
      console.warn("getUserMedia failed, falling back to native camera input:", err)
      cameraInputRef.current?.click()
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (cameraFacing === "user") {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, width, height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
    setImage({
      src: dataUrl,
      name: `camera-${Date.now()}.jpg`,
      size: Math.round(dataUrl.length * 0.75),
    })
    stopCamera()
    toast.success("Photo captured!")
  }

  const switchCamera = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment"
    void startCamera(nextFacing)
  }

  const updateValue = <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors: Record<string, string> = {}
    if (!values.category) nextErrors.category = "Choose a category."
    if (!values.buildingId) nextErrors.building = "Search and select a building from the directory."
    if (!values.floor.trim() || values.floor.trim().length > LOCATION_LIMITS.floor) nextErrors.floor = "Enter a floor number or name (up to 60 characters)."
    if (!values.roomNumber.trim() || values.roomNumber.trim().length > LOCATION_LIMITS.roomNumber) nextErrors.roomNumber = "Enter a room number or name (up to 100 characters)."
    if (values.description.trim().length < REPORT_TEXT_MIN || values.description.trim().length > REPORT_TEXT_MAX) nextErrors.description = `Describe the issue in ${REPORT_TEXT_MIN} to ${REPORT_TEXT_MAX} characters.`
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.error("Review the highlighted fields before submitting.")
      return
    }

    setSubmitting(true)
    try {
      const id = await addReport({
        title: titleFromDescription(values.description),
        category: values.category as ReportCategory,
        building: values.building,
        buildingId: values.buildingId,
        floor: values.floor.trim(),
        roomNumber: values.roomNumber.trim(),
        description: values.description.trim(),
        priority: values.priority,
        images: image ? [image.src] : [],
      })
      toast.success(`${id} was submitted to Campus Operations.`)
      router.push("/student/reports")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save your report. Please try again."
      setErrors(current => ({ ...current, submit: message }))
      toast.error(message)
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <PageHeader
        eyebrow="Student workspace"
        title="Report a campus issue"
        description="Share a few details so the right team can take a look."
        actions={<Link className="button-link button-link-secondary" href="/student/reports">Cancel</Link>}
      />
      <Card className="portal-card form-card">
        <CardHeader className="portal-card-header">
          <div><CardTitle>Issue details</CardTitle><p>Fields marked with an asterisk are required.</p></div>
          <span className="role-chip">New request</span>
        </CardHeader>
        <CardContent className="portal-card-content">
          <form onSubmit={submit} noValidate>
            {errors.submit && <p className="auth-error" role="alert">{errors.submit}</p>}
            <div className="form-two-column">
              <ReportDescriptionField value={values.description} onChange={text => updateValue("description", text)} error={errors.description} disabled={submitting} />

              <Field data-invalid={Boolean(errors.category)}>
                <FieldLabel htmlFor="report-category">Category <span aria-hidden="true">*</span></FieldLabel>
                <select id="report-category" className="form-select" value={values.category} onChange={(event) => {
                  const cat = event.target.value as ReportCategory | ""
                  updateValue("category", cat)
                  if (cat) updateValue("priority", suggestedPriority(cat))
                }} aria-invalid={Boolean(errors.category)}>
                  <option value="">Select a category</option>
                  {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                {errors.category ? <FieldError>{errors.category}</FieldError> : <FieldDescription>Choose the area that best describes the issue.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.building)} className="form-span-2">
                <FieldLabel htmlFor="report-building">Building <span aria-hidden="true">*</span></FieldLabel>
                <BuildingSelector id="report-building" value={values.buildingId} invalid={Boolean(errors.building)} onChange={building => {
                  setValues(current => ({ ...current, buildingId: building?.id || "", building: building?.name || "" }))
                  setErrors(current => ({ ...current, building: "" }))
                }} />
                {errors.building ? <FieldError>{errors.building}</FieldError> : <FieldDescription>Search by name, code (such as F6), or faculty in English or Indonesian.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.floor)}>
                <FieldLabel htmlFor="report-floor">Floor <span aria-hidden="true">*</span></FieldLabel>
                <Input id="report-floor" type="text" className="form-control" value={values.floor} onChange={event => updateValue("floor", event.target.value)} placeholder="e.g. 2nd Floor, Ground Floor, Basement" required aria-invalid={Boolean(errors.floor)} maxLength={LOCATION_LIMITS.floor} />
                {errors.floor ? <FieldError>{errors.floor}</FieldError> : <FieldDescription>Type the floor number or name.</FieldDescription>}
              </Field>
              <Field data-invalid={Boolean(errors.roomNumber)}>
                <FieldLabel htmlFor="report-room">Room Number <span aria-hidden="true">*</span></FieldLabel>
                <Input id="report-room" type="text" className="form-control" value={values.roomNumber} onChange={event => updateValue("roomNumber", event.target.value)} placeholder="e.g. F6.201, Room 205, Laboratory 3" required aria-invalid={Boolean(errors.roomNumber)} maxLength={LOCATION_LIMITS.roomNumber} />
                {errors.roomNumber ? <FieldError>{errors.roomNumber}</FieldError> : <FieldDescription>Type the room number or name.</FieldDescription>}
              </Field>
            </div>

            <div className="form-section-heading"><Camera aria-hidden="true" />Add a photo <span className="optional-label">Optional</span></div>

            {cameraActive ? (
              <div
                style={{
                  position: "relative",
                  borderRadius: "12px",
                  overflow: "hidden",
                  backgroundColor: "#090d16",
                  border: "1px solid #334155",
                  marginBottom: "16px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "320px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />

                {/* Top control bar: Switch camera and close */}
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    display: "flex",
                    gap: "8px",
                    zIndex: 20,
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={switchCamera}
                    title="Switch camera"
                    style={{
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(4px)",
                      color: "#fff",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw style={{ width: "14px", height: "14px" }} />
                    Flip
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={stopCamera}
                    title="Close camera"
                    style={{
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(4px)",
                      color: "#fff",
                      borderRadius: "8px",
                      padding: "6px 10px",
                    }}
                  >
                    <X style={{ width: "16px", height: "16px" }} />
                  </Button>
                </div>

                {/* Bottom shutter bar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    zIndex: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={capturePhoto}
                    aria-label="Capture photo"
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      border: "4px solid rgba(255, 255, 255, 0.5)",
                      boxShadow: "0 0 0 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        backgroundColor: "#2563eb",
                        display: "block",
                      }}
                    />
                  </button>
                  <span
                    style={{
                      color: "#e2e8f0",
                      fontSize: "0.75rem",
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      fontWeight: 500,
                    }}
                  >
                    Tap to capture photo
                  </span>
                </div>
              </div>
            ) : null}

            {!cameraActive ? (
              <div
                className={`upload-dropzone${dragging ? " upload-dropzone-active" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
                onDrop={handleDrop}
              >
                <div>
                  <span className="upload-icon"><Camera aria-hidden="true" /></span>
                  <strong>Take a picture with your camera, or drag and browse files</strong>
                  <p>JPG, PNG, or WebP · up to 5 MB</p>
                  <input ref={uploadRef} id="report-image" className="file-input-hidden" type="file" accept="image/*" onChange={handleFileChange} aria-label="Upload an issue photo" />
                  <input ref={cameraInputRef} id="report-camera" className="file-input-hidden" type="file" accept="image/*" capture="environment" onChange={handleFileChange} aria-label="Take a photo with camera" />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px", flexWrap: "wrap" }}>
                    <Button type="button" variant="default" size="sm" onClick={() => void startCamera()}>
                      <Camera data-icon="inline-start" aria-hidden="true" />
                      Take photo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => uploadRef.current?.click()}>
                      <ImagePlus data-icon="inline-start" aria-hidden="true" />
                      Browse files
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {image ? (
              <div className="upload-preview">
                <img src={image.src} alt={`Preview of ${image.name}`} />
                <div className="upload-preview-caption">
                  <div><strong>{image.name}</strong><span>{(image.size / 1024 / 1024).toFixed(2)} MB · ready to attach</span></div>
                  <Button type="button" variant="ghost" size="icon-sm" className="upload-remove" aria-label="Remove uploaded photo" onClick={() => setImage(null)}><X /></Button>
                </div>
              </div>
            ) : null}

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

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (comment.trim().length < 4) {
      setCommentError("Add at least 4 characters to your follow-up.")
      return
    }
    if (!await addReportUpdate(report.id, comment.trim(), profiles.student.name, "Student follow-up added")) return
    setComment("")
    setCommentError("")
    toast.success("Your follow-up was added to the report timeline.")
  }

  return (
    <>
      <PageHeader eyebrow="Student workspace" title="Report details" description={`Follow the progress on ${report.id}.`} actions={<Link className="button-link button-link-secondary" href="/student/reports">Back to my reports</Link>} />
      <div className="report-detail-grid">
        <div className="detail-main-column">
          <Card className="portal-card">
            <CardHeader className="portal-card-header">
              <div>
                <div className="report-detail-topline"><span className="table-id">{report.id}</span><StatusBadge status={report.status} /><PriorityBadge priority={report.priority} /></div>
                <h2 className="report-detail-title">{report.title}</h2>
                <div className="report-detail-meta">
                  <span><CalendarDays aria-hidden="true" />Submitted {formatDate(report.createdAt)}</span>
                  <span><MapPin aria-hidden="true" />{report.building} · {locationSummary(report)}</span>
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
            <span>{locationSummary(report)}</span>
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
      <div className="notification-list">
        {sorted.length ? sorted.map((notification) => <NotificationItem key={notification.id} notification={notification} role={role} />) : <EmptyState title="No notifications yet" description="Status changes and team updates will appear here." icon={Bell} />}
      </div>
    </>
  )
}
