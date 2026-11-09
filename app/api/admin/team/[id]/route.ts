import { authorizeApi } from "@/lib/auth/authorization"
import { readMutation, accountError } from "@/lib/auth/json-request"
import { limitAuthRequest } from "@/lib/auth/rate-limit"
import { updateMember } from "@/lib/team/service"

export const runtime = "nodejs"
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(["admin"])
  if (auth.error) return auth.error
  try {
    const input = await readMutation(request)
    await limitAuthRequest("team-update", auth.user.id)
    return Response.json(await updateMember(auth.user.id, (await params).id, input), { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return accountError(error) }
}
