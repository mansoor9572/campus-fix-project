import { authorizeApi } from "@/lib/auth/authorization"
import { markNotificationRead } from "@/lib/reports/service"
import { ReportError } from "@/lib/reports/validation"

export const runtime = "nodejs"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const result = await markNotificationRead(authResult.user, id)
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    console.error("Mark notification read error:", error)
    return Response.json({ message: "Failed to update notification." }, { status: 500 })
  }
}

