import { authorizeApi } from "@/lib/auth/authorization"
import { listNotifications, markAllNotificationsRead } from "@/lib/reports/service"

export const runtime = "nodejs"

export async function GET() {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const items = await listNotifications(authResult.user)
    return Response.json(items, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("List notifications error:", error)
    return Response.json({ message: "Failed to load notifications." }, { status: 500 })
  }
}

export async function PATCH() {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const result = await markAllNotificationsRead(authResult.user)
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Mark all notifications read error:", error)
    return Response.json({ message: "Failed to update notifications." }, { status: 500 })
  }
}

