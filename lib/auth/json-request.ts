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

export function accountError(error: unknown, operation: "load" | "save" = "save") {
  if (error instanceof AuthInputError) return Response.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
  // Never log passwords, database query parameters, or request bodies.
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : error
  const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9]{5}$/.test(cause.code) ? cause.code : "UNKNOWN"
  console.error("Team account request failed.", { operation, code })
  return Response.json({ message: operation === "load" ? "Unable to load the team. Please try again." : "Unable to save this change. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } })
}
