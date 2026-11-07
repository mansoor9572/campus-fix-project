import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginPage } from "@/components/campus-fix/public-pages"
import { googleConfigured } from "@/lib/auth/google"
import { dashboardFor } from "@/lib/auth/policy"

export default async function Page({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const session = await auth()
  if (session?.user) redirect(dashboardFor(session.user.role))
  const { error } = await searchParams
  const initialError = error === "GoogleEmailNotSupported"
    ? "Use a verified Gmail or Google Workspace account, or sign in with your CampusFix password."
    : error ? "Sign-in could not be completed. Please try again or use your email and password." : ""
  return <LoginPage googleEnabled={googleConfigured()} initialError={initialError} />
}
