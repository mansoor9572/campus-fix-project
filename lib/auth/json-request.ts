import { appOrigin } from "./email"
import { AuthInputError } from "./validation"

export async function readMutation(request: Request) {
  if (request.headers.get("origin") !== appOrigin()) throw new AuthInputError("Invalid request origin.", 403)
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AuthInputError("JSON required.", 415)
  const reader = request.body?.getReader()
  if (!reader) throw new AuthInputError("Invalid request.")
  const decoder = new TextDecoder()
  let text = "", length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 8192) { await reader.cancel(); throw new AuthInputError("Request too large.", 413) }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  try { return JSON.parse(text) as unknown } catch { throw new AuthInputError("Invalid JSON.") }
}

export function accountError(error: unknown) {
  if (error instanceof AuthInputError) return Response.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
  // Never log passwords, database query parameters, or request bodies.
  console.error("Team account request failed.")
  return Response.json({ message: "Unable to save this change. Please try again." }, { status: 500 })
}
