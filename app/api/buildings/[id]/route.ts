import { authorizeApi } from "@/lib/auth/authorization"
import { saveBuilding } from "@/lib/buildings/service"
import { ReportError } from "@/lib/reports/validation"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Invalid request origin." }, { status: 403 })
  try { return Response.json(await saveBuilding(auth.user, await request.json(), (await params).id)) }
  catch (error) { return Response.json({ message: error instanceof ReportError ? error.message : "Unable to save building. Check for a duplicate building code." }, { status: error instanceof ReportError ? error.status : 400 }) }
}
