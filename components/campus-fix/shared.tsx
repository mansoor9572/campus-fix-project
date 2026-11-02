import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import type { CampusReport, Priority, ReportStatus, ReportUpdate, Role } from "@/lib/campus-fix/data"
import {
  ArrowRight,
  ClipboardList,
  Info,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-lockup${small ? " brand-lockup-small" : ""}`}>
      <span className={`brand-mark${small ? " brand-mark-small" : ""}`} aria-hidden="true">
        <ClipboardList />
      </span>
      <span>CampusFix</span>
    </span>
  )
}

export function RoleAvatar({
  name,
  role,
  className = "",
}: {
  name: string
  role: Role
  className?: string
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

  return (
    <Avatar className={`role-avatar avatar-${role} ${className}`}>
      <AvatarFallback>{initials || "CF"}</AvatarFallback>
    </Avatar>
  )
}

function kebab(value: string) {
  return value.toLowerCase().replaceAll(" ", "-")
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge variant="outline" className={`status-badge status-${kebab(status)}`}>
      {status}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={`priority-badge priority-${kebab(priority)}`}>
      {priority}
    </Badge>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <div className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <Alert className="demo-banner">
      <Info aria-hidden="true" />
      <div>
        <AlertTitle><strong>Demo workspace</strong></AlertTitle>
        <AlertDescription>
          {children ?? "Changes are kept in memory for this session and reset when you refresh."}
        </AlertDescription>
      </div>
    </Alert>
  )
}

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  trend,
}: {
  label: string
  value: string | number
  note: string
  icon: LucideIcon
  trend?: string
}) {
  return (
    <Card className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-icon"><Icon aria-hidden="true" /></span>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-foot">
        {trend ? <strong>{trend}</strong> : null} {note}
      </div>
    </Card>
  )
}

export function PortalCard({
  title,
  description,
  action,
  children,
  className = "",
  contentClassName = "",
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={`portal-card ${className}`}>
      <CardHeader className="portal-card-header">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className={`portal-card-content ${contentClassName}`}>
        {children}
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  icon: Icon = ClipboardList,
  action,
}: {
  title: string
  description: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="empty-icon"><Icon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

export function ReportTable({
  reports,
  hrefFor,
  showReporter = false,
  selectable = false,
  selectedIds = [],
  onToggle,
}: {
  reports: CampusReport[]
  hrefFor: (report: CampusReport) => string
  showReporter?: boolean
  selectable?: boolean
  selectedIds?: string[]
  onToggle?: (id: string, selected: boolean) => void
}) {
  return (
    <>
    <div className="desktop-report-table table-scroll">
      <Table className="portal-table">
        <TableHeader>
          <TableRow>
            {selectable ? <TableHead className="select-cell"><span className="sr-only">Select</span></TableHead> : null}
            <TableHead>Report</TableHead>
            {showReporter ? <TableHead>Reported by</TableHead> : null}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="actions-cell"><span className="sr-only">Open report</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              {selectable ? (
                <TableCell className="select-cell">
                  <Checkbox
                    aria-label={`Select ${report.id}`}
                    checked={selectedIds.includes(report.id)}
                    onCheckedChange={(checked) => onToggle?.(report.id, checked === true)}
                  />
                </TableCell>
              ) : null}
              <TableCell className="report-primary-cell">
                <Link href={hrefFor(report)} className="report-title-link">{report.title}</Link>
                <span className="report-subline">{report.building} · {report.room} · {report.category}</span>
              </TableCell>
              {showReporter ? (
                <TableCell>
                  <span className="reporter-name">{report.reporterName}</span>
                  <span className="report-subline">{report.reporterProgram}</span>
                </TableCell>
              ) : null}
              <TableCell><PriorityBadge priority={report.priority} /></TableCell>
              <TableCell><StatusBadge status={report.status} /></TableCell>
              <TableCell>
                <span className="report-date">{formatDate(report.createdAt)}</span>
              </TableCell>
              <TableCell className="actions-cell">
                <Link href={hrefFor(report)} className="table-open-link" aria-label={`View ${report.id}`}>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <div className="mobile-report-list" role="list" aria-label="Campus reports">
      {reports.map((report) => (
        <article className="mobile-report-card" role="listitem" key={report.id}>
          <div className={`mobile-report-card-heading${selectable ? " has-selection" : ""}`}>
            {selectable ? (
              <Checkbox
                className="mobile-report-select"
                aria-label={`Select ${report.id}`}
                checked={selectedIds.includes(report.id)}
                onCheckedChange={(checked) => onToggle?.(report.id, checked === true)}
              />
            ) : null}
            <div className="mobile-report-copy">
              <Link href={hrefFor(report)} className="mobile-report-title">{report.title}</Link>
              <span className="report-subline">{report.building} · {report.room} · {report.category}</span>
            </div>
            <Link href={hrefFor(report)} className="table-open-link" aria-label={`View ${report.id}`}>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="mobile-report-facts">
            {showReporter ? (
              <div className="mobile-report-reporter">
                <span>Reported by</span>
                <div className="mobile-report-reporter-copy">
                  <span className="reporter-name">{report.reporterName}</span>
                  <span className="report-subline">{report.reporterProgram}</span>
                </div>
              </div>
            ) : null}
            <div className="mobile-report-fact"><span>Priority</span><PriorityBadge priority={report.priority} /></div>
            <div className="mobile-report-fact"><span>Status</span><StatusBadge status={report.status} /></div>
            <div className="mobile-report-fact"><span>Submitted</span><span className="report-date">{formatDate(report.createdAt)}</span></div>
          </div>
        </article>
      ))}
    </div>
    </>
  )
}

export function ReportTimeline({ updates }: { updates: ReportUpdate[] }) {
  return (
    <div className="report-timeline">
      {updates.map((update) => (
        <div className="timeline-item" key={update.id}>
          <div className="timeline-rail"><span className="timeline-dot" aria-hidden="true" /></div>
          <div className="timeline-copy">
            <strong>{update.title}</strong>
            <p>{update.message}</p>
            <small>{update.actor} · {formatDateTime(update.createdAt)}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}
