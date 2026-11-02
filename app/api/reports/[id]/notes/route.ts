import { authorizeApi } from "@/lib/auth/authorization"
import { addReportNote } from "@/lib/reports/service"
import { ReportError } from "@/lib/reports/validation"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const json = await request.json()
    const result = await addReportNote(authResult.user, id, json)
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    console.error("Add note error:", error)
    return Response.json({ message: "Failed to add note." }, { status: 500 })
  }
}

