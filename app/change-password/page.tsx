import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/authorization"
import { dashboardFor } from "@/lib/auth/policy"
import { InitialPasswordPage } from "@/components/campus-fix/initial-password-page"

export default async function Page() {
  const user = await requireUser(undefined, true)
  if (!user.mustChangePassword) redirect(dashboardFor(user.role))
  return <InitialPasswordPage />
}
