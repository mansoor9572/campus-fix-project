import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { privateKey } from "./crypto"
import { AuthInputError } from "./validation"

// Fixed-window slots reuse the existing token table. The composite primary key
// arbitrates concurrent workers; a collision fails closed instead of over-admitting.
export async function rateLimit(scope: string, key: string, limit: number, seconds = 900) {
  const bucket = Math.floor(Date.now() / (seconds * 1000))
  const identifier = `rate:${scope}:${privateKey(key)}:${bucket}`
  const expires = new Date((bucket + 1) * seconds * 1000).toISOString()
  const result = await db.execute(sql`
    INSERT INTO verification_tokens (identifier, token, expires)
    SELECT ${identifier}, slot::text, ${expires}::timestamp
    FROM generate_series(1, ${limit}::integer) AS slot
    WHERE NOT EXISTS (SELECT 1 FROM verification_tokens WHERE identifier = ${identifier} AND token = slot::text)
    ORDER BY slot LIMIT 1 ON CONFLICT DO NOTHING RETURNING token
  `)
  if (!result.rows.length) throw new AuthInputError("Too many attempts. Please try again later.", 429)
}

export async function limitAuthRequest(scope: string, email: string) {
  await rateLimit(scope, email, scope.startsWith("team-") ? 60 : scope === "login" ? 10 : 5)
  // No trust in caller-supplied forwarding headers. Global cap also bounds random-email abuse.
  await rateLimit("global", "all-auth-requests", 300, 60)
}
