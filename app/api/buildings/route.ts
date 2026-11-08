import { authorizeApi } from "@/lib/auth/authorization"
import { listBuildings, saveBuilding } from "@/lib/buildings/service"
import { ReportError } from "@/lib/reports/validation"

export async function GET(request: Request) {
  const auth = await authorizeApi()
  if (auth.error) return auth.error
  const includeInactive = new URL(request.url).searchParams.get("all") === "true"
  if (includeInactive && auth.user.role !== "admin") return Response.json({ message: "Access denied." }, { status: 403 })
  try { return Response.json(await listBuildings(includeInactive), { headers: { "Cache-Control": "no-store" } }) }
  catch { return Response.json({ message: "Unable to load buildings. Please try again." }, { status: 500 }) }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Invalid request origin." }, { status: 403 })
  try { return Response.json(await saveBuilding(auth.user, await request.json()), { status: 201 }) }
  catch (error) { return Response.json({ message: error instanceof ReportError ? error.message : "Unable to save building. Check for a duplicate building code." }, { status: error instanceof ReportError ? error.status : 400 }) }
}
