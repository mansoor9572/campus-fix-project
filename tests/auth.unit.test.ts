import test from "node:test"
import assert from "node:assert/strict"
import { normalizeEmail, validatePassword, validateRegistration, validateToken } from "../lib/auth/validation"
import { routePolicy, dashboardFor } from "../lib/auth/policy"
import { digest, newToken, privateKey, sessionCredentialVersion } from "../lib/auth/crypto"
import { trustedGoogleEmail } from "../lib/auth/google"

test("email normalization and malformed input", () => {
  assert.equal(normalizeEmail("  Student@Campus.EDU "), "student@campus.edu")
  for (const value of [null, [], "", "a@b", "a b@campus.edu", "a".repeat(255) + "@b.edu"]) assert.throws(() => normalizeEmail(value))
})
test("password policy prevents bcrypt truncation and preserves whitespace", () => {
  for (const value of ["short", "a".repeat(73), "😀".repeat(19)]) assert.throws(() => validatePassword(value))
  assert.equal(validatePassword("  long passphrase  "), "  long passphrase  ")
  assert.equal(validatePassword("a".repeat(72)).length, 72)
})
test("registration rejects privileged roles and invalid consent/confirmation", () => {
  const input = { name: " Student ", email: " Student@Campus.edu ", password: "strong test password", confirmPassword: "strong test password", accepted: true }
  assert.deepEqual(validateRegistration(input), { name: "Student", email: "student@campus.edu", password: "strong test password" })
  for (const role of ["admin", "maintenance_staff", "staff", {}, null]) assert.throws(() => validateRegistration({ ...input, role }))
  assert.throws(() => validateRegistration({ ...input, accepted: false }))
  assert.throws(() => validateRegistration({ ...input, confirmPassword: "different" }))
})
test("route authorization covers all existing application routes", () => {
  for (const path of ["/student/dashboard", "/student/reports/new", "/student/reports/123", "/student/notifications"]) assert.deepEqual(routePolicy(path), ["student"])
  assert.deepEqual(routePolicy("/admin/reports/123"), ["admin"])
  assert.deepEqual(routePolicy("/staff/tasks/123"), ["maintenance_staff"])
  for (const path of ["/profile", "/settings", "/notifications"]) assert.equal(routePolicy(path)?.length, 3)
  for (const path of ["/", "/login", "/register", "/reset-password", "/verify-email", "/403"]) assert.equal(routePolicy(path), null)
  assert.equal(dashboardFor("maintenance_staff"), "/staff/dashboard")
})
test("link tokens have 256 bits of randomness and only hashes are persisted", () => {
  const first = newToken(), second = newToken()
  assert.equal(validateToken(first), first)
  assert.notEqual(first, second)
  assert.notEqual(digest(first), first)
  assert.equal(digest(first).length, 64)
  assert.throws(() => validateToken("bad"))
})

test("Google linking requires a verified address Google is authoritative for", () => {
  const profile = { sub: "google-subject", email: " Student@Gmail.com ", email_verified: true }
  assert.equal(trustedGoogleEmail(profile), "student@gmail.com")
  assert.equal(trustedGoogleEmail({ ...profile, email: "student@campus.edu", hd: "campus.edu" }), "student@campus.edu")
  for (const invalid of [undefined, {}, { ...profile, sub: "" }, { ...profile, email_verified: false },
    { ...profile, email_verified: "true" }, { ...profile, email: "student@elsewhere.com" },
    { ...profile, email: "student@elsewhere.com", hd: " " }, { ...profile, email: "not-an-email" }]) {
    assert.equal(trustedGoogleEmail(invalid), null)
  }
})

test("Google-only session fingerprints are user-specific and invalidated by password changes", () => {
  const originalSecret = process.env.AUTH_SECRET
  process.env.AUTH_SECRET = "unit-test-secret-with-at-least-32-characters"
  try {
    const googleVersion = sessionCredentialVersion("user-one", null)
    assert.notEqual(googleVersion, sessionCredentialVersion("user-two", null))
    assert.notEqual(googleVersion, sessionCredentialVersion("user-one", "new-password-hash"))
    assert.equal(sessionCredentialVersion("user-one", "existing-hash"), privateKey("existing-hash"))
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = originalSecret
  }
})
