import { authorizeApi } from "@/lib/auth/authorization"
import { getReferenceData } from "@/lib/reports/service"

export const runtime = "nodejs"

export async function GET() {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const data = await getReferenceData()
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=60" },
    })
  } catch (error) {
    console.error("Reference data error:", error)
    return Response.json({ message: "Failed to load reference data." }, { status: 500 })
  }
}

