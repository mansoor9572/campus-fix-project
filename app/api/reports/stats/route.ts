import { authorizeApi } from "@/lib/auth/authorization"
import { getDashboardStats } from "@/lib/reports/service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const url = new URL(request.url)
    const days = url.searchParams.get("days") || "all"
    const stats = await getDashboardStats(authResult.user, days)
    return Response.json(stats, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return Response.json({ message: "Failed to load dashboard stats." }, { status: 500 })
  }
}

