import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { normalizeEmail } from "./validation"

export async function bootstrapAdministrator(address: string) {
  const email = normalizeEmail(address)
  // The transaction-scoped lock serializes two operators bootstrapping at once.
  // Neon HTTP supports batched transactions, not interactive transactions.
  const [, result] = await db.batch([
    db.execute(sql`SELECT pg_advisory_xact_lock(731940217)`),
    db.execute(sql`
      WITH promoted AS (
        UPDATE users SET role = 'admin', updated_at = now()
        WHERE email = ${email} AND role = 'student' AND is_active = true
        AND email_verified IS NOT NULL AND password IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
        RETURNING id
      ), audited AS (
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        SELECT id, 'bootstrap_first_admin', 'user', id::text, '{"method":"operator-cli"}' FROM promoted
      ), revoked AS (
        DELETE FROM sessions WHERE user_id IN (SELECT id FROM promoted)
      ) SELECT id FROM promoted
    `),
  ])
  if (result.rows.length !== 1) throw new Error("No account promoted: an administrator already exists, or the target is not an active, verified student with a password.")
}
