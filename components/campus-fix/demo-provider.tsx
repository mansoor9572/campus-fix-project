"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { uiRole } from "@/lib/auth/policy"
import {
  INITIAL_PROFILES,
  type CampusNotification,
  type CampusReport,
  type DemoProfile,
  type MaintenanceDepartment,
  type Priority,
  type ReportCategory,
  type ReportStatus,
  type Role,
} from "@/lib/campus-fix/data"
import { toast } from "sonner"

export type NewReportInput = {
  title: string
  description: string
  category: ReportCategory
  building: string
  buildingId: string
  floor: string
  roomNumber: string
  additionalDetails?: string
  priority: Priority
  images: string[]
}

export type ReportPatch = {
  status?: ReportStatus
  priority?: Priority
  category?: ReportCategory
  department?: MaintenanceDepartment | null
  assignedTo?: string | null
}

type Preferences = {
  emailUpdates: boolean
  inAppNotifications: boolean
  weeklyDigest: boolean
  compactTables: boolean
}

type ReferenceData = {
  buildings: Array<{ id: string; name: string; code: string | null }>
  categories: Array<{ id: string; name: string; defaultDepartmentId?: string | null }>
  departments: Array<{ id: string; name: string }>
  staff: Array<{ id: string; name: string; email: string }>
}

export type DashboardStats = {
  total: number
  pending: number
  inProgress: number
  resolved: number
  urgent: number
  resolutionRate: number
  avgResolutionHours: number | null
  byCategory: Array<{ category: string; count: number }>
  byBuilding: Array<{ building: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
  workload: Array<{ staffId: string; name: string; openCount: number }>
}

type DemoDataContextValue = {
  reports: CampusReport[]
  notifications: CampusNotification[]
  profiles: Record<Role, DemoProfile>
  activeRole: Role
  preferences: Preferences
  searchTerm: string
  stats: DashboardStats | null
  setSearchTerm: (value: string) => void
  fetchStats: (days?: string) => Promise<DashboardStats | null>
  addReport: (input: NewReportInput) => Promise<string>
  changeReport: (id: string, patch: ReportPatch, actor?: string) => void
  addReportUpdate: (id: string, message: string, actor: string, title?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  updateProfile: (role: Role, values: Partial<DemoProfile>) => void
  updatePreference: (key: keyof Preferences, value: boolean) => void
}

const DemoDataContext = createContext<DemoDataContextValue | null>(null)

// Older API responses omitted history. Normalize at the boundary so every
// report consumer (including timelines and optimistic updates) gets an array.
function normalizeReport(report: CampusReport): CampusReport {
  return { ...report, updates: Array.isArray(report.updates) ? report.updates : [] }
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [reports, setReports] = useState<CampusReport[]>([])
  const [notifications, setNotifications] = useState<CampusNotification[]>([])
  const [demoProfiles, setProfiles] = useState<Record<Role, DemoProfile>>(() => ({ ...INITIAL_PROFILES }))
  const [refData, setRefData] = useState<ReferenceData>({
    buildings: [],
    categories: [],
    departments: [],
    staff: [],
  })

  const activeRole: Role = session?.user ? uiRole(session.user.role) : "student"
  const profiles = session?.user
    ? {
        ...demoProfiles,
        [activeRole]: {
          ...demoProfiles[activeRole],
          name: session.user.name || "CampusFix user",
          email: session.user.email || "",
          roleLabel:
            activeRole === "staff"
              ? "Maintenance staff"
              : activeRole === "admin"
                ? "Administrator"
                : "Student",
        },
      }
    : demoProfiles

  const [searchTerm, setSearchTerm] = useState("")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [preferences, setPreferences] = useState<Preferences>({
    emailUpdates: true,
    inAppNotifications: true,
    weeklyDigest: false,
    compactTables: false,
  })

  const fetchStats = useCallback(
    async (days = "all"): Promise<DashboardStats | null> => {
      if (status !== "authenticated" || !session?.user) return null
      try {
        const res = await fetch(`/api/reports/stats?days=${encodeURIComponent(days)}`)
        if (res.ok) {
          const data: DashboardStats = await res.json()
          setStats(data)
          return data
        }
      } catch (err) {
        console.error("Failed to load dashboard stats:", err)
      }
      return null
    },
    [status, session?.user]
  )

  // Load real data from server when authenticated
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return

    let isMounted = true

    // Fetch reference data (buildings, categories, departments, staff)
    fetch("/api/reference-data")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setRefData(data)
      })
      .catch((err) => console.error("Failed to load reference data:", err))

    // Fetch dashboard stats
    fetch("/api/reports/stats?days=all")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setStats(data)
      })
      .catch((err) => console.error("Failed to load dashboard stats:", err))

    // Fetch reports
    fetch("/api/reports?pageSize=100")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reports.")
        return res.json()
      })
      .then((data) => {
        if (!Array.isArray(data?.reports)) throw new Error("Invalid report response.")
        if (isMounted) {
          setReports(data.reports.map(normalizeReport))
        }
      })
      .catch((err) => {
        console.error("Failed to load reports:", err)
        if (isMounted) toast.error("Failed to load reports. Please reload to try again.")
      })

    // Fetch notifications
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setNotifications(data)
        }
      })
      .catch((err) => console.error("Failed to load notifications:", err))

    return () => {
      isMounted = false
    }
  }, [status, session?.user])

  const addReport = async (input: NewReportInput): Promise<string> => {
    if (!session?.user) throw new Error("Sign in before submitting a report.")
    let references = refData
    if (!references.categories.length) {
      const response = await fetch("/api/reference-data")
      if (!response.ok) throw new Error("Unable to load report categories. Please try again.")
      references = await response.json() as ReferenceData
      setRefData(references)
    }
    const category = references.categories.find(c => c.name.toLowerCase() === input.category.toLowerCase())
    if (!category) throw new Error("This category is unavailable. Please choose another category.")
    const uploadedImages = []
    for (const imgSrc of input.images) {
      if (!imgSrc.startsWith("data:")) continue
      const blob = await (await fetch(imgSrc)).blob()
      const form = new FormData()
      form.append("file", blob, "photo.jpg")
      const response = await fetch("/api/uploads", { method: "POST", body: form })
      if (!response.ok) throw new Error("Your photo could not be uploaded. Please try again.")
      uploadedImages.push(await response.json())
    }
    const response = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title, description: input.description,
        buildingId: input.buildingId, categoryId: category.id, floor: input.floor,
        roomNumber: input.roomNumber, additionalDetails: input.additionalDetails || "",
        priority: input.priority === "Urgent" || input.priority === "High" ? "high" : input.priority.toLowerCase(),
        images: uploadedImages }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Failed to save report. Please try again.")
    setReports(current => [normalizeReport(result), ...current])
    void fetch("/api/notifications").then(response => response.ok ? response.json() : null)
      .then(data => { if (Array.isArray(data)) setNotifications(data) }).catch(() => {})
    void fetchStats()
    return result.id
  }

  const changeReport = (id: string, patch: ReportPatch, actor = "Campus Operations") => {
    const createdAt = new Date().toISOString()
    const targetReport = reports.find((r) => r.id === id)

    setReports((current) =>
      current.map((report) => {
        if (report.id !== id) return report
        const parts: string[] = []
        if (patch.status && patch.status !== report.status) parts.push(`Status changed to ${patch.status}.`)
        if (patch.priority && patch.priority !== report.priority) parts.push(`Priority changed to ${patch.priority}.`)
        if (patch.category && patch.category !== report.category) parts.push(`Category changed to ${patch.category}.`)
        if (patch.department !== undefined && patch.department !== report.department) {
          parts.push(patch.department ? `Routed to ${patch.department}.` : "Department assignment removed.")
        }
        if (patch.assignedTo !== undefined && patch.assignedTo !== report.assignedTo) {
          parts.push(patch.assignedTo ? `Assigned to ${patch.assignedTo}.` : "Assignment removed.")
        }
        const updates = parts.length
          ? [
              {
                id: `${id}-${Date.now()}`,
                createdAt,
                actor,
                title: "Report updated",
                message: parts.join(" "),
              },
              ...report.updates,
            ]
          : report.updates
        return { ...report, ...patch, updatedAt: createdAt, version: createdAt, updates }
      })
    )

    if (patch.status) {
      setNotifications((current) => [
        {
          id: `${id}-status-${Date.now()}`,
          title: `Report ${id} updated`,
          message: `The status is now ${patch.status}.`,
          createdAt,
          read: false,
          reportId: id,
          type: "status",
        },
        ...current,
      ])
    }

    // If authenticated, sync with server
    if (session?.user && targetReport) {
      const payload: Record<string, unknown> = {
        version: targetReport.version || targetReport.updatedAt,
      }

      if (patch.status) {
        payload.status = patch.status.toLowerCase().replace(/ /g, "_")
      }
      if (patch.priority) {
        payload.priority =
          patch.priority === "Urgent" || patch.priority === "High"
            ? "high"
            : patch.priority === "Low"
              ? "low"
              : "medium"
      }
      if (patch.category) {
        const cat = refData.categories.find(
          (c) => c.name.toLowerCase() === patch.category?.toLowerCase()
        )
        if (cat) payload.categoryId = cat.id
      }
      if (patch.department !== undefined) {
        if (patch.department === null) {
          payload.departmentId = null
        } else {
          const dept = refData.departments.find(
            (d) => d.name.toLowerCase() === patch.department?.toLowerCase()
          )
          if (dept) payload.departmentId = dept.id
        }
      }
      if (patch.assignedTo !== undefined) {
        if (patch.assignedTo === null || patch.assignedTo === "") {
          payload.assignedStaffId = null
        } else {
          const staffMember = refData.staff.find(
            (s) => s.name.toLowerCase() === patch.assignedTo?.toLowerCase()
          )
          if (staffMember) payload.assignedStaffId = staffMember.id
        }
      }

      fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.message || "Failed to update report.")
          }
          const serverReport = await res.json()
          setReports((current) =>
            current.map((r) => (r.id === id ? normalizeReport({ ...r, ...serverReport }) : r))
          )
          void fetchStats()
        })
        .catch((err) => {
          console.error("Change report error:", err)
          toast.error(err.message || "Failed to update report on server.")
        })
    }
  }

  const addReportUpdate = (
    id: string,
    message: string,
    actor: string,
    title = "Team note added"
  ) => {
    const createdAt = new Date().toISOString()
    const targetReport = reports.find((r) => r.id === id)

    setReports((current) =>
      current.map((report) => {
        if (report.id !== id) return report
        return {
          ...report,
          updatedAt: createdAt,
          version: createdAt,
          updates: [
            {
              id: `${id}-${Date.now()}`,
              createdAt,
              actor,
              title,
              message,
            },
            ...report.updates,
          ],
        }
      })
    )

    // If authenticated, sync note to server
    if (session?.user && targetReport) {
      fetch(`/api/reports/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          isPublic: true,
          version: targetReport.version || targetReport.updatedAt,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.message || "Failed to add note.")
          }
        })
        .catch((err) => {
          console.error("Add report update error:", err)
          toast.error(err.message || "Failed to add note on server.")
        })
    }
  }

  const markNotificationRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )

    if (session?.user) {
      fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch((err) =>
        console.error("Failed to mark notification read:", err)
      )
    }
  }

  const markAllNotificationsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    )

    if (session?.user) {
      fetch("/api/notifications", { method: "PATCH" }).catch((err) =>
        console.error("Failed to mark all notifications read:", err)
      )
    }
  }

  const updateProfile = (role: Role, values: Partial<DemoProfile>) => {
    setProfiles((current) => ({
      ...current,
      [role]: { ...current[role], ...values },
    }))
  }

  const updatePreference = (key: keyof Preferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  return (
    <DemoDataContext.Provider
      value={{
        reports,
        notifications,
        profiles,
        activeRole,
        preferences,
        searchTerm,
        stats,
        setSearchTerm,
        fetchStats,
        addReport,
        changeReport,
        addReportUpdate,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfile,
        updatePreference,
      }}
    >
      {children}
    </DemoDataContext.Provider>
  )
}

export function useDemoData() {
  const context = useContext(DemoDataContext)
  if (!context) throw new Error("useDemoData must be used within DemoDataProvider")
  return context
}
