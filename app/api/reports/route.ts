import { authorizeApi } from "@/lib/auth/authorization"
import { createReport, listReports } from "@/lib/reports/service"
import { ReportError } from "@/lib/reports/validation"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const url = new URL(request.url)
    const result = await listReports(authResult.user, url.searchParams)
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    console.error("List reports error:", error)
    return Response.json({ message: "Failed to list reports." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await authorizeApi(["student", "admin"])
  if (authResult.error) return authResult.error

  try {
    const json = await request.json()
    const result = await createReport(authResult.user, json)
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    console.error("Create report error:", error)
    return Response.json({ message: "Failed to create report." }, { status: 500 })
  }
}

