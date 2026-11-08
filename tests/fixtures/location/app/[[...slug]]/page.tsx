"use client"

// Isolated browser test app; never part of the production app/ route tree.
import { usePathname } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import { DemoDataProvider } from "@/components/campus-fix/demo-provider"
import { CampusFixRouter } from "@/components/campus-fix/campus-fix-router"
import { Toaster } from "sonner"

export default function Page() {
  const route = usePathname()
  const role = route.startsWith("/admin") ? "admin" : route.startsWith("/staff") ? "maintenance_staff" : "student"
  return <SessionProvider session={{ user: { id: "11111111-1111-4111-8111-111111111111", name: "Location Test", email: "location@example.invalid", role }, expires: "2099-01-01T00:00:00Z" }} refetchOnWindowFocus={false}>
    <DemoDataProvider><CampusFixRouter route={route === "/" ? "/student/reports/new" : route} /><Toaster /></DemoDataProvider>
  </SessionProvider>
}
