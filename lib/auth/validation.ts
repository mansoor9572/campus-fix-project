export class AuthInputError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthInputError("Enter a valid email address.")
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthInputError("Enter a valid email address.")
  }
  return email
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || Buffer.byteLength(value, "utf8") > 72) {
    throw new AuthInputError("Use at least 12 characters and at most 72 UTF-8 bytes for your password.")
  }
  return value
}

export function validateRegistration(input: Record<string, unknown>) {
  if (input.role !== undefined && input.role !== "student") throw new AuthInputError("Self-registration is for students only.")
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (name.length < 2 || name.length > 100) throw new AuthInputError("Enter a name between 2 and 100 characters.")
  const email = normalizeEmail(input.email)
  const password = validatePassword(input.password)
  if (password !== input.confirmPassword) throw new AuthInputError("Your passwords do not match.")
  if (input.accepted !== true) throw new AuthInputError("Confirm that you agree to create an account.")
  return { name, email, password }
}

export function validateToken(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new AuthInputError("This link is invalid or expired.")
  return value
}
