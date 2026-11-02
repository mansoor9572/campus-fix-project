import type { UserRole } from "@/lib/db/schema"

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60
export const SHORT_SESSION_AGE = 8 * 60 * 60
export const dashboardFor = (role: UserRole) => `/${role === "maintenance_staff" ? "staff" : role}/dashboard`
export const uiRole = (role: UserRole) => role === "maintenance_staff" ? "staff" : role

export function routePolicy(path: string): UserRole[] | null {
  const prefix = path.split("/")[1]
  if (prefix === "student") return ["student"]
  if (prefix === "admin") return ["admin"]
  if (prefix === "staff") return ["maintenance_staff"]
  if (["profile", "settings", "notifications"].includes(prefix)) return ["student", "admin", "maintenance_staff"]
  return null
}
