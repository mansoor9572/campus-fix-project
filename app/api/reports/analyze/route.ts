import { authorizeApi } from "@/lib/auth/authorization"
import { triageFacilityIssue } from "@/lib/ai/gemini"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await authorizeApi(["student", "admin", "maintenance_staff"])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { title, description, building, room, image } = body

    if (!title || typeof title !== "string" || !description || typeof description !== "string") {
      return Response.json(
        { message: "Title and description are required for AI analysis." },
        { status: 400 }
      )
    }

    const triage = await triageFacilityIssue({
      title: title.slice(0, 200),
      description: description.slice(0, 2000),
      building: typeof building === "string" ? building : undefined,
      room: typeof room === "string" ? room : undefined,
      image: image && typeof image.base64 === "string" ? image : undefined,
    })

    return Response.json({ triage })
  } catch (error) {
    console.error("AI analysis error:", error)
    return Response.json(
      { message: "Unable to complete AI analysis at this time." },
      { status: 500 }
    )
  }
}
