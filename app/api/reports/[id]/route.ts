import { authorizeApi } from "@/lib/auth/authorization"
import { getReportById, updateReport } from "@/lib/reports/service"
import { ReportError } from "@/lib/reports/validation"
import { readMutation, accountError } from "@/lib/auth/json-request"
import { AuthInputError } from "@/lib/auth/validation"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const result = await getReportById(authResult.user, id)
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    console.error("Get report error:", error)
    return Response.json({ message: "Failed to get report." }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const json = await readMutation(request)
    const result = await updateReport(authResult.user, id, json)
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof ReportError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    if (error instanceof AuthInputError) return accountError(error)
    console.error("Update report failed.")
    return Response.json({ message: "Failed to update report." }, { status: 500 })
  }
}

