import { authorizeApi } from "@/lib/auth/authorization"
import { getAiAnalysis, reviewAiAnalysis } from "@/lib/ai/service"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(["student", "admin", "maintenance_staff"])
  if (auth.error) return auth.error

  const { id } = await params
  try {
    const analysis = await getAiAnalysis(id)
    if (!analysis) {
      return Response.json({ message: "No AI analysis found." }, { status: 404 })
    }
    return Response.json({ analysis })
  } catch (error) {
    console.error("Fetch AI analysis error:", error)
    return Response.json({ message: "Internal server error." }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error

  const { id } = await params
  try {
    const body = await request.json()
    const { action } = body

    const validActions: Record<string, "accepted" | "rejected" | "corrected"> = {
      approved: "accepted",
      accepted: "accepted",
      rejected: "rejected",
      modified: "corrected",
      corrected: "corrected",
    }

    const reviewStatus = action ? validActions[action] : undefined

    if (!reviewStatus) {
      return Response.json(
        { message: "Invalid action. Must be 'approved', 'accepted', 'rejected', or 'corrected'." },
        { status: 400 }
      )
    }

    const updated = await reviewAiAnalysis(id, auth.user.id, reviewStatus)
    return Response.json({ analysis: updated })
  } catch (error) {
    console.error("Review AI analysis error:", error)
    return Response.json(
      { message: (error as Error).message || "Unable to update AI review status." },
      { status: 400 }
    )
  }
}
