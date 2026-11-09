import { AuthInputError, normalizeEmail, validatePassword } from "@/lib/auth/validation"

export function objectInput(raw: unknown, allowed: string[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AuthInputError("Invalid request.")
  const input = raw as Record<string, unknown>
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new AuthInputError("Unsupported field.")
  return input
}

export function teamId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) throw new AuthInputError("Choose a valid account or department.")
  return value
}

export function createMemberInput(raw: unknown) {
  const input = objectInput(raw, ["name", "email", "role", "departmentId", "password"])
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (name.length < 2 || name.length > 100) throw new AuthInputError("Enter a name between 2 and 100 characters.")
  if (input.role !== "admin" && input.role !== "maintenance_staff") throw new AuthInputError("Choose worker or administrator.")
  if (input.role === "admin" && input.departmentId != null) throw new AuthInputError("Administrators do not have a worker department.")
  return { name, email: normalizeEmail(input.email), role: input.role,
    departmentId: input.role === "maintenance_staff" ? teamId(input.departmentId) : null,
    password: validatePassword(input.password) }
}

export function updateMemberInput(raw: unknown) {
  const input = objectInput(raw, ["departmentId", "isActive", "password"])
  if (Object.keys(input).length !== 1) throw new AuthInputError("Make one account change at a time.")
  if (input.departmentId !== undefined) return { kind: "department" as const, departmentId: teamId(input.departmentId) }
  if (input.password !== undefined) return { kind: "password" as const, password: validatePassword(input.password) }
  if (typeof input.isActive !== "boolean") throw new AuthInputError("Choose an active or inactive account status.")
  return { kind: "active" as const, isActive: input.isActive }
}
