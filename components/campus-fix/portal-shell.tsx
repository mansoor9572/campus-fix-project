"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Bell,
  ChevronDown,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useDemoData } from "@/components/campus-fix/demo-provider"
import { BrandMark, RoleAvatar } from "@/components/campus-fix/shared"
import type { Role } from "@/lib/campus-fix/data"

const roleLabels: Record<Role, string> = {
  student: "Student workspace",
  admin: "Campus operations",
  staff: "Facilities team",
}

const dashboardRoutes: Record<Role, string> = {
  student: "/student/dashboard",
  admin: "/admin/dashboard",
  staff: "/staff/dashboard",
}

const notificationRoutes: Record<Role, string> = {
  student: "/student/notifications",
  admin: "/notifications",
  staff: "/notifications",
}

type NavigationItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  count?: number
}

function getNavigation(role: Role): NavigationItem[] {
  if (role === "student") {
    return [
      { label: "Overview", href: "/student/dashboard", icon: LayoutDashboard },
      { label: "My reports", href: "/student/reports", icon: ClipboardCheck },
      { label: "New report", href: "/student/reports/new", icon: FilePlus2 },
      { label: "Notifications", href: "/student/notifications", icon: Bell },
    ]
  }
  if (role === "admin") {
    return [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "All reports", href: "/admin/reports", icon: ClipboardCheck },
      { label: "Team management", href: "/admin/team", icon: UserRound },
      { label: "Building directory", href: "/admin/buildings", icon: LayoutDashboard },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ]
  }
  return [
    { label: "My tasks", href: "/staff/dashboard", icon: Wrench },
    { label: "Notifications", href: "/notifications", icon: Bell },
  ]
}

function isActiveItem(route: string, href: string, label: string) {
  if (label === "My tasks") return route === "/staff/dashboard" || route.startsWith("/staff/tasks/")
  if (route === href) return true
  if (label === "My reports" && route.startsWith("/student/reports/")) return !route.endsWith("/new")
  if (label === "All reports" && route.startsWith("/admin/reports/")) return true
  return false
}

function PortalSidebar({
  role,
  route,
  onNavigate,
}: {
  role: Role
  route: string
  onNavigate?: () => void
}) {
  const { profiles, notifications } = useDemoData()
  const profile = profiles[role]
  const navigation = getNavigation(role)
  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <aside className="portal-sidebar">
      <Link className="sidebar-brand" href={dashboardRoutes[role]} onClick={onNavigate} aria-label="CampusFix workspace home">
        <BrandMark small />
      </Link>
      <div className="sidebar-label">{roleLabels[role]}</div>
      <nav className="sidebar-nav" aria-label={`${roleLabels[role]} navigation`}>
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = isActiveItem(route, href, label)
          return (
            <Link
              className={active ? "sidebar-nav-link sidebar-nav-link-active" : "sidebar-nav-link"}
              href={href}
              key={label}
              aria-current={active ? "page" : undefined}
              aria-label={label === "Notifications" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : undefined}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {label === "Notifications" && unreadCount > 0 ? <span className="sidebar-count" aria-hidden="true">{unreadCount}</span> : null}
            </Link>
          )
        })}
      </nav>
      <div className="sidebar-separator" aria-hidden="true" />
      <div className="sidebar-label">Account</div>
      <nav className="sidebar-nav" aria-label="Account navigation">
        <Link className={route === "/profile" ? "sidebar-nav-link sidebar-nav-link-active" : "sidebar-nav-link"} href="/profile" onClick={onNavigate} aria-current={route === "/profile" ? "page" : undefined}>
          <UserRound aria-hidden="true" /><span>My profile</span>
        </Link>
        <Link className={route === "/settings" ? "sidebar-nav-link sidebar-nav-link-active" : "sidebar-nav-link"} href="/settings" onClick={onNavigate} aria-current={route === "/settings" ? "page" : undefined}>
          <Settings aria-hidden="true" /><span>Settings</span>
        </Link>
      </nav>
      <div className="sidebar-account">
        <RoleAvatar name={profile.name} role={role} />
        <div className="sidebar-account-copy">
          <strong>{profile.name}</strong>
          <span>{profile.roleLabel}</span>
        </div>
      </div>
    </aside>
  )
}

function getPageTitle(route: string, role: Role) {
  if (route === "/student/dashboard" || route === "/admin/dashboard" || route === "/staff/dashboard") return "Overview"
  if (route === "/student/reports") return "My reports"
  if (route === "/student/reports/new") return "New report"
  if (route.startsWith("/student/reports/")) return "Report details"
  if (route === "/admin/reports") return "All reports"
  if (route === "/admin/team") return "Team management"
  if (route.startsWith("/admin/reports/")) return "Review report"
  if (route.startsWith("/staff/tasks/")) return "Task details"
  if (route === "/notifications" || route === "/student/notifications") return "Notifications"
  if (route === "/profile") return "My profile"
  if (route === "/settings") return "Settings"
  return roleLabels[role]
}

export function PortalShell({
  role,
  route,
  children,
}: {
  role: Role
  route: string
  children: ReactNode
}) {
  const router = useRouter()
  const { profiles, notifications, searchTerm, setSearchTerm } = useDemoData()
  const { status } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState({ source: searchTerm, value: searchTerm })
  const searchValue = searchDraft.source === searchTerm ? searchDraft.value : searchTerm
  const profile = profiles[role]
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const pageTitle = getPageTitle(route, role)

  useEffect(() => {
    if (status === "unauthenticated") window.location.replace("/login")
  }, [status])

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm(searchValue.trim())
    const destination = role === "admin" ? "/admin/reports" : role === "student" ? "/student/reports" : "/staff/dashboard"
    router.push(destination)
  }

  return (
    <div className="portal-layout">
      <PortalSidebar role={role} route={route} />
      <div className="portal-main">
        <header className="portal-topbar">
          <div className="topbar-left">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="mobile-nav-trigger" aria-label="Open navigation" />}
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="mobile-sheet" showCloseButton>
                <SheetHeader>
                  <SheetTitle className="sr-only">CampusFix navigation</SheetTitle>
                </SheetHeader>
                <PortalSidebar role={role} route={route} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="topbar-crumb"><span>CampusFix</span><span aria-hidden="true">/</span><strong>{pageTitle}</strong></div>
          </div>
          <form className="topbar-search" role="search" onSubmit={submitSearch}>
            <Search aria-hidden="true" />
            <input
              type="search"
              aria-label="Search reports"
              placeholder="Search reports, buildings..."
              value={searchValue}
              onChange={(event) => setSearchDraft({ source: searchTerm, value: event.target.value })}
            />
          </form>
          <div className="topbar-actions">
            <Link className="topbar-icon-button" href={notificationRoutes[role]} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
              <Bell aria-hidden="true" />
              {unreadCount ? <span className="notification-dot" aria-hidden="true" /> : null}
            </Link>
            <details className="profile-dropdown">
              <summary className="topbar-profile" aria-label="Open account menu">
                <RoleAvatar name={profile.name} role={role} />
                <span className="topbar-profile-name">{profile.name}</span>
                <ChevronDown className="topbar-profile-chevron" aria-hidden="true" />
              </summary>
              <div className="profile-menu">
                <Link href="/profile"><UserRound aria-hidden="true" />My profile</Link>
                <Link href="/settings"><Settings aria-hidden="true" />Settings</Link>
                <button type="button" disabled={signingOut} onClick={async () => {
                  setSigningOut(true)
                  try { await signOut({ redirectTo: "/login" }) }
                  catch { toast.error("Unable to sign out. Please try again."); setSigningOut(false) }
                }}><LogOut aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button>
              </div>
            </details>
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  )
}
