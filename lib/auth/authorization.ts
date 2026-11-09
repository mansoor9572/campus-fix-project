import "server-only"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/db/schema"

export async function requireUser(roles?: readonly UserRole[], allowPasswordChange = false) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.mustChangePassword && !allowPasswordChange) redirect("/change-password")
  if (roles && !roles.includes(session.user.role)) redirect("/403")
  return session.user
}

// Use at every future API boundary; hiding a button or checking a layout is insufficient.
export async function authorizeApi(roles?: readonly UserRole[], allowPasswordChange = false) {
  const session = await auth()
  if (!session?.user) return { error: Response.json({ message: "Authentication required." }, { status: 401 }) }
  if (session.user.mustChangePassword && !allowPasswordChange) return { error: Response.json({ message: "Change your temporary password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 }) }
  if (roles && !roles.includes(session.user.role)) return { error: Response.json({ message: "Access denied." }, { status: 403 }) }
  return { user: session.user }
}
