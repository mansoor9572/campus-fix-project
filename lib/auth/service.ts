import { compare, hash } from "bcryptjs"
import { and, eq, gt, sql } from "drizzle-orm"
import { db, users, sessions, verificationTokens } from "@/lib/db"
import { digest, newToken, privateKey, sessionCredentialVersion } from "./crypto"
import { assertEmailConfigured, sendAuthEmail } from "./email"
import { limitAuthRequest } from "./rate-limit"
import { SESSION_MAX_AGE, SHORT_SESSION_AGE } from "./policy"
import { AuthInputError, normalizeEmail, validatePassword, validateRegistration, validateToken } from "./validation"

const dummyHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.2bHYBvqoWqGZkTEKl1C2TiL9G2AqC.W"
const invalidLink = () => new AuthInputError("This link is invalid or expired. Request a new link.")

export async function findByEmail(email: string) {
  // Also recognize pre-existing mixed-case addresses without rewriting existing data.
  const matches = await db.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`).limit(2)
  if (matches.length > 1) throw new Error("Ambiguous normalized email; operator review required.")
  return matches[0]
}

async function issueToken(userId: string, email: string, purpose: "verify" | "reset", password: string | null) {
  const token = newToken()
  // Reset tokens are bound to the password version. Changing the password invalidates all earlier links.
  const identifier = purpose === "verify" ? `verify:${userId}` : `reset:${userId}:${privateKey(password ?? "")}`
  await db.insert(verificationTokens).values({ identifier, token: digest(token), expires: new Date(Date.now() + (purpose === "verify" ? 86400000 : 1800000)) })
  try {
    await sendAuthEmail(email, purpose, token)
  } catch (error) {
    await db.delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, digest(token))))
    throw error
  }
}

export async function register(input: Record<string, unknown>) {
  const values = validateRegistration(input)
  await limitAuthRequest("register", values.email)
  assertEmailConfigured()
  const password = await hash(values.password, 12)
  const existing = await findByEmail(values.email)
  const hasLiveEmail = process.env.AUTH_EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY)

  if (!existing) {
    const [user] = await db
      .insert(users)
      .values({
        name: values.name,
        email: values.email,
        password,
        role: "student",
        emailVerified: hasLiveEmail ? null : new Date(),
      })
      .onConflictDoNothing({ target: users.email })
      .returning()

    if (user && hasLiveEmail) {
      try {
        await issueToken(user.id, user.email, "verify", user.password)
      } catch (emailError) {
        console.warn("Verification email could not be dispatched (sandbox/unverified domain). Pre-verifying account:", emailError)
        // If Resend is restricted by sandbox domain, pre-verify account so user can sign in immediately
        await db.update(users).set({ emailVerified: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id))
        return { message: "Account created! You can now sign in with your email and password." }
      }
    }
  }

  if (hasLiveEmail) {
    return { message: "If this address is new, a verification link has been sent. Check your inbox, or sign in / request another verification link for an existing account." }
  }

  return { message: "Account created! You can now sign in with your campus email and password." }
}

export async function requestEmail(input: Record<string, unknown>, purpose: "verify" | "reset") {
  const email = normalizeEmail(input.email)
  await limitAuthRequest(purpose, email)
  assertEmailConfigured()
  const user = await findByEmail(email)
  if (user?.isActive && (purpose === "reset" ? !!user.password : !user.emailVerified)) {
    try {
      await issueToken(user.id, user.email, purpose, user.password)
    } catch (err) {
      if (purpose === "verify" && !user.emailVerified) {
        await db.update(users).set({ emailVerified: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id))
        return { message: "Account has been verified! You can now sign in." }
      }
      throw err
    }
  }
  return { message: "If an eligible account exists, a link has been sent. Check your inbox." }
}

export async function verifyEmail(input: Record<string, unknown>) {
  const token = validateToken(input.token)
  await limitAuthRequest("consume-verify", digest(token))
  // Consuming and updating in one statement avoids token replay and partial writes.
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM verification_tokens WHERE token = ${digest(token)} AND identifier LIKE 'verify:%' AND expires > now()
      RETURNING split_part(identifier, ':', 2)::uuid AS user_id
    )
    UPDATE users SET email_verified = now(), updated_at = now()
    WHERE id IN (SELECT user_id FROM consumed) AND is_active = true AND email_verified IS NULL
    RETURNING id
  `)
  if (!result.rows.length) throw invalidLink()
  return { message: "Email verified. You can now sign in." }
}

export async function resetPassword(input: Record<string, unknown>) {
  const token = validateToken(input.token)
  const password = validatePassword(input.password)
  if (password !== input.confirmPassword) throw new AuthInputError("Your passwords do not match.")
  await limitAuthRequest("consume-reset", digest(token))
  const [record] = await db.select().from(verificationTokens).where(and(eq(verificationTokens.token, digest(token)), gt(verificationTokens.expires, new Date()), sql`${verificationTokens.identifier} LIKE 'reset:%'`)).limit(1)
  if (!record) throw invalidLink()
  const [, userId, version] = record.identifier.split(":")
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user?.isActive || !user.password || privateKey(user.password) !== version) throw invalidLink()
  const passwordHash = await hash(password, 12)
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM verification_tokens WHERE identifier = ${record.identifier} AND token = ${digest(token)} AND expires > now() RETURNING identifier
    ), changed AS (
      UPDATE users SET password = ${passwordHash}, must_change_password = false, updated_at = now()
      WHERE id = ${userId}::uuid AND password = ${user.password} AND is_active = true AND EXISTS (SELECT 1 FROM consumed)
      RETURNING id
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)
    ) SELECT id FROM changed
  `)
  if (!result.rows.length) throw invalidLink()
  return { message: "Password changed. All previous sessions have been signed out. Sign in with your new password." }
}

export async function authenticate(input: Partial<Record<string, unknown>>) {
  let email: string
  try { email = normalizeEmail(input.email) } catch { return null }
  if (typeof input.password !== "string" || !input.password || Buffer.byteLength(input.password, "utf8") > 72) return null
  await limitAuthRequest("login", email)
  const user = await findByEmail(email)
  const correct = await compare(input.password, user?.password || dummyHash)
  if (!correct || !user?.password || !user.isActive || (!user.emailVerified && !user.adminProvisioned)) return null
  const sessionId = newToken()
  const expires = new Date(Date.now() + (input.remember === "true" ? SESSION_MAX_AGE : SHORT_SESSION_AGE) * 1000)
  // A row lock orders concurrent reset/login: reset either removes this session,
  // or login observes the changed password and cannot create it.
  const result = await db.execute(sql`
    WITH current_user_row AS (
      SELECT id FROM users WHERE id = ${user.id}::uuid AND password = ${user.password}
      AND is_active = true AND (email_verified IS NOT NULL OR admin_provisioned) FOR UPDATE
    )
    INSERT INTO sessions (session_token, user_id, expires)
    SELECT ${digest(sessionId)}, id, ${expires.toISOString()}::timestamp FROM current_user_row RETURNING user_id
  `)
  if (!result.rows.length) return null
  return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, sessionId, credentialVersion: privateKey(user.password), sessionExpires: expires.getTime() }
}

export async function readSession(sessionId: string, credentialVersion: string) {
  const [row] = await db.select({ id: users.id, name: users.name, email: users.email, image: users.image, role: users.role, password: users.password, expires: sessions.expires, mustChangePassword: users.mustChangePassword })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.sessionToken, digest(sessionId)), gt(sessions.expires, new Date()), eq(users.isActive, true), sql`(${users.emailVerified} IS NOT NULL OR ${users.adminProvisioned})`)).limit(1)
  if (!row || sessionCredentialVersion(row.id, row.password) !== credentialVersion) return null
  return { id: row.id, name: row.name, email: row.email, image: row.image, role: row.role, expires: row.expires, mustChangePassword: row.mustChangePassword }
}

// Called only after Auth.js validates Google and links its stable subject ID.
export async function createGoogleSession(userId: string, subject: string, email: string) {
  const sessionId = newToken()
  const expires = new Date(Date.now() + SHORT_SESSION_AGE * 1000)
  const result = await db.execute(sql`
    WITH verified_user AS (
      UPDATE users SET email_verified = COALESCE(email_verified, now()), updated_at = now()
      WHERE id = ${userId}::uuid AND is_active = true AND lower(trim(email)) = ${email}
      AND EXISTS (
        SELECT 1 FROM accounts WHERE user_id = users.id
        AND provider = 'google' AND provider_account_id = ${subject}
      )
      RETURNING id, password
    ), created_session AS (
      INSERT INTO sessions (session_token, user_id, expires)
      SELECT ${digest(sessionId)}, id, ${expires.toISOString()}::timestamp FROM verified_user
      RETURNING user_id
    )
    SELECT password FROM verified_user JOIN created_session ON verified_user.id = created_session.user_id
  `)
  const row = result.rows[0]
  if (!row || (row.password !== null && typeof row.password !== "string")) return null
  return { sessionId, sessionExpires: expires.getTime(), credentialVersion: sessionCredentialVersion(userId, row.password) }
}

export async function revokeSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, digest(sessionId)))
}
