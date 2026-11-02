import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

export function appOrigin() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000")
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("APP_URL must be an origin.")
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL must use HTTPS in production.")
  return url.origin
}

export function assertEmailConfigured() {
  appOrigin()
  const provider = process.env.AUTH_EMAIL_PROVIDER
  if (provider === "file" && process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(appOrigin()).hostname)) return
  if (provider === "resend" && process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM) return
  throw new Error("Configure AUTH_EMAIL_PROVIDER and email credentials; file delivery is allowed only in local development.")
}

export async function sendAuthEmail(to: string, purpose: "verify" | "reset", token: string) {
  assertEmailConfigured()
  const url = new URL(purpose === "verify" ? "/verify-email" : "/reset-password", appOrigin())
  // Fragments keep bearer secrets out of access logs and Referer headers.
  url.hash = new URLSearchParams({ token }).toString()
  const subject = purpose === "verify" ? "Verify your CampusFix email" : "Reset your CampusFix password"
  const text = `${subject}\n\nOpen this link and submit the form:\n${url}\n\nThis link expires in ${purpose === "verify" ? "24 hours" : "30 minutes"}. If you did not request this, ignore this email.`
  if (process.env.AUTH_EMAIL_PROVIDER === "file") {
    const directory = path.join(process.cwd(), ".auth-outbox")
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path.join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ to, subject, text }, null, 2), { mode: 0o600, flag: "wx" })
    return
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error("Email provider rejected the request.")
}
