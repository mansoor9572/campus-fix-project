import { authorizeApi } from "@/lib/auth/authorization"
import { rateLimit } from "@/lib/auth/rate-limit"
import { AuthInputError } from "@/lib/auth/validation"
import { rewriteInput, rewriteReportText } from "@/lib/ai/rewrite"
import { ReportError } from "@/lib/reports/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await authorizeApi(["student", "admin"])
  if (auth.error) return auth.error
  const origin = request.headers.get("origin")
  if (origin) {
    const originHost = new URL(origin).host
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host
    if (originHost !== requestHost && origin !== new URL(request.url).origin) {
      return Response.json({ message: "Invalid request origin." }, { status: 403 })
    }
  }
  try {
    if (Number(request.headers.get("content-length")) > 24000) throw new ReportError("Rewrite request is too large.", 413)
    const raw = await request.text()
    if (Buffer.byteLength(raw, "utf8") > 24000) throw new ReportError("Rewrite request is too large.", 413)
    let body: unknown
    try { body = JSON.parse(raw) } catch { throw new ReportError("Invalid rewrite request.") }
    const text = rewriteInput(body)
    await rateLimit("report-rewrite", auth.user.id, 10)
    const rewritten = await rewriteReportText(text)
    return Response.json({ text: rewritten }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof ReportError || error instanceof AuthInputError) return Response.json({ message: error.message }, { status: error.status })
    return Response.json({ message: "Unable to rewrite right now. You can still submit your own wording." }, { status: 503 })
  }
}
