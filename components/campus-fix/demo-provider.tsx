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
  assignedStaffId?: string | null
  departmentId?: string | null
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
  staff: Array<{ id: string; name: string; email: string; departmentId: string | null; openTasks: number }>
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
  currentUserId: string | null
  refData: ReferenceData
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
  changeReport: (id: string, patch: ReportPatch, actor?: string) => Promise<boolean>
  addReportUpdate: (id: string, message: string, actor: string, title?: string) => Promise<boolean>
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
      if (status !== "authenticated" || !session?.user || session.user.mustChangePassword) return null
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
    [status, session]
  )

  // Load real data from server when authenticated
  useEffect(() => {
    if (status !== "authenticated" || !session?.user || session.user.mustChangePassword) return

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
  }, [status, session])

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

  const changeReport = async (id: string, patch: ReportPatch): Promise<boolean> => {
    const report = reports.find(item => item.id === id)
    if (!session?.user || !report) return false
    try {
      const payload: Record<string, unknown> = { version: report.version || report.updatedAt }
      if (patch.status) payload.status = patch.status.toLowerCase().replaceAll(" ", "_")
      if (patch.priority) payload.priority = patch.priority === "Urgent" ? "high" : patch.priority.toLowerCase()
      if (patch.category) {
        const category = refData.categories.find(item => item.name.toLowerCase() === patch.category?.toLowerCase())
        if (!category) throw new Error("Choose an available category.")
        payload.categoryId = category.id
      }
      if (patch.department !== undefined) {
        const department = refData.departments.find(item => item.name === patch.department)
        if (patch.department && !department) throw new Error("Choose an available department.")
        payload.departmentId = department?.id ?? null
      }
      if (patch.departmentId !== undefined) payload.departmentId = patch.departmentId
      if (patch.assignedStaffId !== undefined) payload.assignedStaffId = patch.assignedStaffId
      const response = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to save report.")
      setReports(current => current.map(item => item.id === id ? normalizeReport(result) : item))
      void fetchStats()
      return true
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save report."); return false }
  }

  const addReportUpdate = async (id: string, message: string): Promise<boolean> => {
    const report = reports.find(item => item.id === id)
    if (!session?.user || !report) return false
    try {
      const response = await fetch(`/api/reports/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, isPublic: true, version: report.version || report.updatedAt }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to save note.")
      const refreshed = await fetch(`/api/reports/${id}`)
      if (!refreshed.ok) throw new Error("Note saved. Reload to see the updated history.")
      const updated = normalizeReport(await refreshed.json())
      setReports(current => current.map(item => item.id === id ? updated : item))
      return true
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save note."); return false }
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
        currentUserId: session?.user?.id ?? null,
        refData,
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
