import { authorizeApi } from "@/lib/auth/authorization"
import { readMutation, accountError } from "@/lib/auth/json-request"
import { limitAuthRequest } from "@/lib/auth/rate-limit"
import { listTeam, createMember } from "@/lib/team/service"

export const runtime = "nodejs"
export async function GET() {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error
  try { return Response.json(await listTeam(), { headers: { "Cache-Control": "no-store" } }) }
  catch (error) { return accountError(error) }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error
  try {
    const input = await readMutation(request)
    await limitAuthRequest("team-create", auth.user.id)
    return Response.json(await createMember(auth.user.id, input), { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) { return accountError(error) }
}
