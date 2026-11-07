import { normalizeEmail } from "./validation"

// Google is authoritative for Gmail and hosted Workspace addresses only.
// A third-party address can stay marked verified after its ownership changes.
export function trustedGoogleEmail(profile: Record<string, unknown> | undefined): string | null {
  if (!profile || profile.email_verified !== true || typeof profile.sub !== "string" || !profile.sub) return null
  try {
    const email = normalizeEmail(profile.email)
    return email.endsWith("@gmail.com") || (typeof profile.hd === "string" && profile.hd.trim().length > 0) ? email : null
  } catch {
    return null
  }
}

export function googleConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim())
}
