import type { ReportStatus, UserRole, Priority } from "@/lib/db/schema"

export const statusLabels: Record<ReportStatus, string> = {
  submitted: "Submitted", under_review: "Under Review", approved: "Approved", assigned: "Assigned",
  in_progress: "In Progress", resolved: "Resolved", closed: "Closed", rejected: "Rejected", reopened: "Reopened",
}
export const priorityLabels: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" }
const adminTransitions: Record<ReportStatus, ReportStatus[]> = {
  submitted: ["under_review", "approved", "assigned", "in_progress", "rejected"],
  under_review: ["approved", "assigned", "in_progress", "rejected"],
  approved: ["under_review", "assigned", "in_progress", "rejected"],
  assigned: ["approved", "in_progress", "under_review", "rejected"],
  in_progress: ["assigned", "resolved", "under_review", "rejected"],
  resolved: ["closed", "reopened", "in_progress"],
  closed: ["reopened"],
  rejected: ["reopened", "under_review"],
  reopened: ["under_review", "approved", "assigned", "in_progress", "rejected"],
}
export function transitions(role: UserRole, status: ReportStatus): ReportStatus[] {
  if (role === "admin") return adminTransitions[status]
  if (role === "student") return status === "resolved" ? ["closed", "reopened"] : status === "closed" ? ["reopened"] : []
  return status === "assigned" ? ["in_progress"] : status === "in_progress" ? ["resolved"] : status === "reopened" ? ["in_progress"] : []
}
export function canAccessReport(actor: { id: string; role: UserRole }, report: { studentId: string; assignedStaffId: string | null }) {
  return actor.role === "admin" || (actor.role === "student" ? report.studentId === actor.id : report.assignedStaffId === actor.id)
}
export const isTerminal = (status: ReportStatus) => ["resolved", "closed", "rejected"].includes(status)
