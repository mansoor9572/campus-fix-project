import { appOrigin } from "@/lib/auth/email"
import { AuthInputError } from "@/lib/auth/validation"
import { register, requestEmail, resetPassword, verifyEmail } from "@/lib/auth/service"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    // Explicit same-origin JSON-only boundary prevents cross-site form/JSON CSRF.
    if (request.headers.get("origin") !== appOrigin()) return Response.json({ message: "Invalid request origin." }, { status: 403 })
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ message: "JSON required." }, { status: 415 })
    const { action } = await params
    if (!["register", "resend-verification", "forgot-password", "verify-email", "reset-password"].includes(action)) return Response.json({ message: "Not found." }, { status: 404 })
    // Bound streamed input too, rather than trusting Content-Length.
    const reader = request.body?.getReader()
    if (!reader) throw new AuthInputError("Invalid request.")
    let text = ""
    let length = 0
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 8192) { await reader.cancel(); throw new AuthInputError("Request too large.", 413) }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    let input: Record<string, unknown>
    try { input = JSON.parse(text) } catch { throw new AuthInputError("Invalid JSON.") }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new AuthInputError("Invalid request.")
    const result = action === "register" ? await register(input)
      : action === "verify-email" ? await verifyEmail(input)
      : action === "reset-password" ? await resetPassword(input)
      : await requestEmail(input, action === "forgot-password" ? "reset" : "verify")
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof AuthInputError) return Response.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.status === 429 ? { "Retry-After": "900" } : {}) } })
    console.error("Account request failed; check database and email configuration.")
    return Response.json({ message: "Unable to complete this request. Please try again later. If you already registered, use Resend verification." }, { status: 503 })
  }
}
