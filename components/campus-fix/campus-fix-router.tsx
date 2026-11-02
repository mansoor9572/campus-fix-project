"use client"

import { useDemoData } from "@/components/campus-fix/demo-provider"
import { PortalShell } from "@/components/campus-fix/portal-shell"
import { LandingPage, LoginPage, RegisterPage } from "@/components/campus-fix/public-pages"
import {
  AccessDeniedPage,
  AdminDashboard,
  AdminReportDetails,
  AdminReports,
  NotFoundPage,
  ProfilePage,
  SettingsPage,
  StaffDashboard,
  StaffTaskDetails,
} from "@/components/campus-fix/operations-pages"
import {
  NewStudentReport,
  NotificationsPage,
  StudentDashboard,
  StudentReportDetails,
  StudentReports,
} from "@/components/campus-fix/student-pages"
import type { Role } from "@/lib/campus-fix/data"
import { AccountRecoveryPage } from "./account-recovery"

function pathRole(route: string): Role | null {
  const prefix = route.split("/")[1]
  if (prefix === "student" || prefix === "admin" || prefix === "staff") return prefix
  return null
}

export function CampusFixRouter({ route }: { route: string }) {
  const normalizedRoute = route.length > 1 ? route.replace(/\/+$/, "") : route
  const { activeRole } = useDemoData()

  if (normalizedRoute === "/") return <LandingPage />
  if (normalizedRoute === "/login") return <LoginPage />
  if (normalizedRoute === "/register") return <RegisterPage />
  if (normalizedRoute === "/forgot-password" || normalizedRoute === "/reset-password" || normalizedRoute === "/verify-email" || normalizedRoute === "/resend-verification") {
    return <AccountRecoveryPage key={normalizedRoute} action={normalizedRoute.slice(1) as "forgot-password" | "reset-password" | "verify-email" | "resend-verification"} />
  }
  if (normalizedRoute === "/403") return <AccessDeniedPage />
  if (normalizedRoute === "/404") return <NotFoundPage />

  const role = pathRole(normalizedRoute) ?? activeRole
  let content = null

  if (normalizedRoute === "/student/dashboard") content = <StudentDashboard />
  else if (normalizedRoute === "/student/reports") content = <StudentReports />
  else if (normalizedRoute === "/student/reports/new") content = <NewStudentReport />
  else if (normalizedRoute.startsWith("/student/reports/")) {
    const reportId = normalizedRoute.split("/").at(-1) ?? ""
    content = <StudentReportDetails key={reportId} reportId={reportId} />
  } else if (normalizedRoute === "/admin/dashboard") content = <AdminDashboard />
  else if (normalizedRoute === "/admin/reports") content = <AdminReports />
  else if (normalizedRoute.startsWith("/admin/reports/")) {
    const reportId = normalizedRoute.split("/").at(-1) ?? ""
    content = <AdminReportDetails key={reportId} reportId={reportId} />
  } else if (normalizedRoute === "/staff/dashboard") content = <StaffDashboard />
  else if (normalizedRoute.startsWith("/staff/tasks/")) {
    const taskId = normalizedRoute.split("/").at(-1) ?? ""
    content = <StaffTaskDetails key={taskId} taskId={taskId} />
  } else if (normalizedRoute === "/notifications" || normalizedRoute === "/student/notifications") content = <NotificationsPage role={role} />
  else if (normalizedRoute === "/profile") content = <ProfilePage key={role} role={role} />
  else if (normalizedRoute === "/settings") content = <SettingsPage />
  else return <NotFoundPage />

  return (
    <PortalShell role={role} route={normalizedRoute}>
      {content}
    </PortalShell>
  )
}
