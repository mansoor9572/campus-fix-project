import { authorizeApi } from "@/lib/auth/authorization"
import { readMutation, accountError } from "@/lib/auth/json-request"
import { limitAuthRequest } from "@/lib/auth/rate-limit"
import { changeInitialPassword } from "@/lib/team/service"

export const runtime = "nodejs"
export async function POST(request: Request) {
  const auth = await authorizeApi(undefined, true)
  if (auth.error) return auth.error
  try {
    const input = await readMutation(request)
    await limitAuthRequest("initial-password", auth.user.id)
    return Response.json(await changeInitialPassword(auth.user.id, input), { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return accountError(error) }
}
