import { hash, compare } from "bcryptjs"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { AuthInputError, validatePassword } from "@/lib/auth/validation"
import { createMemberInput, updateMemberInput, teamId, objectInput } from "./validation"

// Account changes and report assignments share a transaction lock. Eligibility
// cannot change between checking a worker and assigning a report to them.
export const teamWriteLock = sql`SELECT pg_advisory_xact_lock(731940218)`
const readyAdmin = (id: string) => sql`EXISTS (SELECT 1 FROM users WHERE id = ${id}::uuid AND role = 'admin' AND is_active AND NOT must_change_password)`

export async function listTeam() {
  const [members, departments] = await Promise.all([
    db.execute(sql`SELECT u.id, u.name, u.email, u.role, u.is_active AS "isActive",
      u.department_id AS "departmentId", d.name AS "departmentName", u.must_change_password AS "mustChangePassword",
      (SELECT count(*)::integer FROM reports r WHERE r.assigned_staff_id = u.id AND r.status NOT IN ('resolved','closed','rejected')) AS "openTasks"
      FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.role IN ('admin','maintenance_staff') ORDER BY u.name, u.email`),
    db.execute(sql`SELECT id, name FROM departments WHERE is_active ORDER BY name`),
  ])
  return { members: members.rows, departments: departments.rows }
}

export async function createMember(actorId: string, raw: unknown) {
  const input = createMemberInput(raw)
  const password = await hash(input.password, 12)
  const [, result] = await db.batch([
    db.execute(teamWriteLock),
    db.execute(sql`WITH created AS (
      INSERT INTO users (name, email, password, role, department_id, must_change_password, admin_provisioned)
      SELECT ${input.name}, ${input.email}, ${password}, ${input.role}::user_role, ${input.departmentId}::uuid, true, true
      WHERE ${readyAdmin(actorId)}
      AND NOT EXISTS (SELECT 1 FROM users WHERE lower(trim(email)) = ${input.email})
      AND (${input.departmentId}::uuid IS NULL OR EXISTS (SELECT 1 FROM departments WHERE id = ${input.departmentId}::uuid AND is_active))
      ON CONFLICT DO NOTHING RETURNING id
    ), audited AS (
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      SELECT ${actorId}::uuid, 'team.account_created', 'user', id::text,
        ${JSON.stringify({ role: input.role, departmentId: input.departmentId })} FROM created
    ) SELECT id FROM created`),
  ])
  if (!result.rows.length) throw new AuthInputError("Account not created. The email may already exist, the department may be inactive, or your access changed.", 409)
  return { id: result.rows[0].id, message: "Account created. Share the temporary password with the account holder. They must change it at first login." }
}

export async function updateMember(actorId: string, id: string, raw: unknown) {
  teamId(id)
  const input = updateMemberInput(raw)
  if (actorId === id) throw new AuthInputError("Use another administrator to manage your account.", 400)
  const password = input.kind === "password" ? await hash(input.password, 12) : null
  const change = input.kind === "password"
    ? sql`password = ${password}, must_change_password = true`
    : input.kind === "department" ? sql`department_id = ${input.departmentId}::uuid` : sql`is_active = ${input.isActive}`
  const guard = input.kind === "department"
    ? sql`u.role = 'maintenance_staff' AND EXISTS (SELECT 1 FROM departments WHERE id = ${input.departmentId}::uuid AND is_active)
        AND NOT EXISTS (SELECT 1 FROM reports WHERE assigned_staff_id = u.id AND status NOT IN ('resolved','closed','rejected'))`
    : input.kind === "active" && !input.isActive
      ? sql`NOT EXISTS (SELECT 1 FROM reports WHERE assigned_staff_id = u.id AND status NOT IN ('resolved','closed','rejected'))
          AND (u.role <> 'admin' OR EXISTS (SELECT 1 FROM users other WHERE other.id <> u.id AND other.role = 'admin' AND other.is_active AND NOT other.must_change_password))`
      : sql`true`
  const [, result] = await db.batch([
    db.execute(teamWriteLock),
    db.execute(sql`WITH changed AS (
      UPDATE users u SET ${change}, updated_at = now()
      WHERE u.id = ${id}::uuid AND u.role IN ('admin','maintenance_staff') AND ${readyAdmin(actorId)} AND ${guard}
      RETURNING u.id
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)
    ), audited AS (
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      SELECT ${actorId}::uuid, ${`team.${input.kind}_changed`}, 'user', id::text,
        ${JSON.stringify(input.kind === "password" ? { temporaryPassword: true } : input)} FROM changed
    ) SELECT id FROM changed`),
  ])
  if (!result.rows.length) throw new AuthInputError("Change not saved. Reassign unfinished tasks first, keep an active administrator, and select an active department. Reload if the account changed.", 409)
  return { message: input.kind === "password" ? "Temporary password reset. Previous sessions have been signed out." : "Account updated." }
}

export async function changeInitialPassword(userId: string, raw: unknown) {
  const input = objectInput(raw, ["currentPassword", "password", "confirmPassword"])
  const password = validatePassword(input.password)
  const currentPassword = validatePassword(input.currentPassword)
  if (password !== input.confirmPassword) throw new AuthInputError("Your passwords do not match.")
  const current = await db.execute(sql`SELECT password FROM users WHERE id = ${userId}::uuid AND is_active AND must_change_password`)
  const oldHash = current.rows[0]?.password
  if (typeof oldHash !== "string" || !await compare(currentPassword, oldHash)) throw new AuthInputError("The temporary password is incorrect, or this account has already been updated.")
  if (await compare(password, oldHash)) throw new AuthInputError("Choose a new password different from the temporary password.")
  const passwordHash = await hash(password, 12)
  const [, result] = await db.batch([
    db.execute(teamWriteLock),
    db.execute(sql`WITH changed AS (
      UPDATE users SET password = ${passwordHash}, must_change_password = false, updated_at = now()
      WHERE id = ${userId}::uuid AND password = ${oldHash} AND is_active AND must_change_password RETURNING id
    ), revoked AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)),
    audited AS (
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      SELECT id, 'team.initial_password_changed', 'user', id::text, '{}' FROM changed
    ) SELECT id FROM changed`),
  ])
  if (!result.rows.length) throw new AuthInputError("Your account changed. Sign in again.", 409)
  return { message: "Password changed. Sign in with your new password." }
}
