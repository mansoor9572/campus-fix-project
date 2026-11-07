import { createHash, createHmac, randomBytes } from "node:crypto"
export const newToken = () => randomBytes(32).toString("hex")
export const digest = (value: string) => createHash("sha256").update(value).digest("hex")
export function privateKey(value: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error("Configure AUTH_SECRET with at least 32 random characters.")
  return createHmac("sha256", secret).update(value).digest("hex")
}

export function sessionCredentialVersion(userId: string, password: string | null) {
  return privateKey(password ?? `google-user:${userId}`)
}
