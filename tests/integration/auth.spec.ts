import { test, expect, type APIRequestContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { readdir, readFile, unlink } from "node:fs/promises"
import path from "node:path"
import { eq, inArray, sql } from "drizzle-orm"
import { compare } from "bcryptjs"
import { db, users, sessions, verificationTokens, auditLogs } from "../../lib/db"
import { digest, privateKey } from "../../lib/auth/crypto"
import { bootstrapAdministrator } from "../../lib/auth/bootstrap"

const origin = "http://127.0.0.1:3100"
const password = "Test-only campus passphrase 42!"
const addresses: string[] = []
const mailFiles = new Set<string>()
let referenceSnapshot: unknown

function address() {
  const email = `auth-test-${randomUUID()}@example.invalid`
  addresses.push(email)
  return email
}
async function post(request: APIRequestContext, action: string, data: Record<string, unknown>) {
  return request.post(`/api/account/${action}`, { data, headers: { Origin: origin } })
}
async function register(request: APIRequestContext, email: string) {
  const response = await post(request, "register", { name: "Authentication Test", email, password, confirmPassword: password, accepted: true })
  expect(response.status()).toBe(200)
  return response.json()
}
async function userFor(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  expect(user).toBeTruthy()
  return user
}
async function latestMail(email: string, subject: string) {
  let found: { file: string; text: string } | undefined
  await expect.poll(async () => {
    const files = await readdir(".auth-outbox").catch(() => [])
    for (const file of files.sort().reverse()) {
      const absolute = path.join(".auth-outbox", file)
      const mail = JSON.parse(await readFile(absolute, "utf8")) as { to: string; subject: string; text: string }
      if (mail.to === email) mailFiles.add(absolute)
      if (mail.to === email && mail.subject.includes(subject) && !found) found = { file: absolute, text: mail.text }
    }
    return !!found
  }).toBe(true)
  const url = found!.text.match(/http:\/\/127\.0\.0\.1:3100\/\S+/)![0]
  return { url, token: new URLSearchParams(new URL(url).hash.slice(1)).get("token")! }
}
async function verify(request: APIRequestContext, email: string) {
  const mail = await latestMail(email, "Verify")
  expect((await post(request, "verify-email", { token: mail.token })).status()).toBe(200)
}
async function login(request: APIRequestContext, email: string, value = password, remember = "false") {
  const csrfToken = (await (await request.get("/api/auth/csrf")).json()).csrfToken
  return request.post("/api/auth/callback/credentials", {
    form: { email, password: value, remember, csrfToken, callbackUrl: `${origin}/student/dashboard` },
    headers: { Origin: origin, "X-Auth-Return-Redirect": "1" },
  })
}
async function session(request: APIRequestContext) {
  return (await request.get("/api/auth/session")).json()
}
async function snapshot() {
  return (await db.execute(sql`SELECT
    (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM buildings b) AS buildings,
    (SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM departments d) AS departments,
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM facility_categories c) AS categories,
    (SELECT count(*)::integer FROM reports) AS reports,
    (SELECT count(*)::integer FROM drizzle.__drizzle_migrations) AS migrations`)).rows
}

test.beforeAll(async () => { referenceSnapshot = await snapshot() })
test.afterAll(async () => {
  if (addresses.length) {
    const created = await db.select({ id: users.id }).from(users).where(inArray(users.email, addresses))
    for (const { id } of created) {
      await db.delete(verificationTokens).where(sql`identifier = ${`verify:${id}`} OR identifier LIKE ${`reset:${id}:%`}`)
      await db.delete(auditLogs).where(sql`actor_id = ${id}::uuid AND action = 'bootstrap_first_admin'`)
      await db.delete(users).where(eq(users.id, id))
    }
    for (const email of addresses) await db.delete(verificationTokens).where(sql`identifier LIKE ${`rate:%:${privateKey(email)}:%`}`)
  }
  // Files are removed only when their recipient is one of this run's random addresses.
  for (const file of await readdir(".auth-outbox").catch(() => [])) {
    const absolute = path.join(".auth-outbox", file)
    const mail = JSON.parse(await readFile(absolute, "utf8")) as { to: string }
    if (addresses.includes(mail.to)) mailFiles.add(absolute)
  }
  for (const file of mailFiles) await unlink(file).catch(() => {})
  expect(await snapshot()).toEqual(referenceSnapshot)
})

test("browser registration, verification, login, logout and password recovery", async ({ page, request }) => {
  const email = address()
  await page.goto("/register")
  await page.getByLabel("Full name", { exact: true }).fill("Authentication Test")
  await page.getByLabel("Campus email").fill(email.toUpperCase())
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password", { exact: true }).fill(password)
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: "Create account", exact: true }).click()
  await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible()
  const user = await userFor(email)
  expect(user.role).toBe("student")
  expect(user.emailVerified).toBeNull()
  expect(user.password).not.toBe(password)
  expect(await compare(password, user.password!)).toBe(true)
  await login(request, email)
  expect(await session(request)).toBeNull()
  const duplicate = await register(request, email)
  expect(duplicate.message).toContain("If this address is new")
  expect((await userFor(email)).id).toBe(user.id)
  const mail = await latestMail(email, "Verify")
  const [stored] = await db.select().from(verificationTokens).where(eq(verificationTokens.token, digest(mail.token)))
  expect(stored.token).not.toBe(mail.token)
  await page.goto(mail.url)
  await page.getByRole("button", { name: "Verify email", exact: true }).click()
  await expect(page.getByRole("status").filter({ hasText: "Email verified" })).toBeVisible()
  expect((await post(request, "verify-email", { token: mail.token })).status()).toBe(400)
  await page.goto("/login")
  await page.getByLabel("Campus email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(/\/student\/dashboard$/)
  await expect(page.locator(".topbar-profile-name")).toHaveText("Authentication Test")
  const cookies = await page.context().cookies()
  const sessionCookie = cookies.find(cookie => cookie.name.endsWith("session-token"))!
  expect(sessionCookie.httpOnly).toBe(true)
  expect(sessionCookie.sameSite).toBe("Lax")
  const stolen = await page.request.storageState()
  await page.goto("/admin/dashboard")
  await expect(page).toHaveURL(/\/403$/)
  await page.goto("/student/dashboard")
  await page.getByLabel("Open account menu").click()
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0)
  const replay = await page.context().browser()!.newContext({ storageState: stolen, baseURL: origin })
  expect(await session(replay.request)).toBeNull()
  await replay.close()
  await page.goto("/student/dashboard")
  await expect(page).toHaveURL(/\/login$/)

  await login(request, email)
  expect((await session(request)).user.id).toBe(user.id)
  await page.goto("/forgot-password")
  await page.getByLabel("Campus email").fill(email)
  await page.getByRole("button", { name: "Send link" }).click()
  await expect(page.getByRole("status").filter({ hasText: "eligible account" })).toBeVisible()
  const reset = await latestMail(email, "Reset")
  expect((await post(request, "forgot-password", { email })).status()).toBe(200)
  const siblingReset = await latestMail(email, "Reset")
  expect(siblingReset.token).not.toBe(reset.token)
  const newPassword = "A different campus passphrase 73!"
  await page.goto(reset.url)
  await page.getByLabel("New password", { exact: true }).fill(newPassword)
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword)
  await page.getByRole("button", { name: "Reset password", exact: true }).click()
  await expect(page.getByRole("status").filter({ hasText: "Password changed" })).toBeVisible()
  expect(await session(request)).toBeNull()
  expect((await post(request, "reset-password", { token: reset.token, password, confirmPassword: password })).status()).toBe(400)
  expect((await post(request, "reset-password", { token: siblingReset.token, password, confirmPassword: password })).status()).toBe(400)
  await login(request, email, password)
  expect(await session(request)).toBeNull()
  await login(request, email, newPassword)
  expect((await session(request)).user.id).toBe(user.id)
})

test("server role checks, live role changes, account deactivation and absolute session expiry", async ({ request }) => {
  const email = address()
  await register(request, email)
  await verify(request, email)
  const user = await userFor(email)
  for (const [role, allowed, forbidden] of [
    ["student", "/student/dashboard", "/admin/dashboard"],
    ["admin", "/admin/dashboard", "/staff/dashboard"],
    ["maintenance_staff", "/staff/dashboard", "/student/dashboard"],
  ] as const) {
    await db.update(users).set({ role }).where(eq(users.id, user.id))
    await login(request, email)
    expect((await session(request)).user.role).toBe(role)
    expect((await request.get(allowed, { maxRedirects: 0 })).status()).toBe(200)
    const denied = await request.get(forbidden, { maxRedirects: 0 })
    expect(denied.status()).toBe(307)
    expect(denied.headers().location).toBe("/403")
  }
  await db.update(users).set({ role: "student" }).where(eq(users.id, user.id))
  expect((await session(request)).user.role).toBe("student")
  const csrfToken = (await (await request.get("/api/auth/csrf")).json()).csrfToken
  await request.post("/api/auth/session", { data: { csrfToken, data: { role: "admin", user: { role: "admin" } } }, headers: { Origin: origin } })
  expect((await session(request)).user.role).toBe("student")
  await db.update(users).set({ isActive: false }).where(eq(users.id, user.id))
  expect(await session(request)).toBeNull()
  await login(request, email)
  expect(await session(request)).toBeNull()
  await db.update(users).set({ isActive: true }).where(eq(users.id, user.id))
  await login(request, email, password, "true")
  const longExpiry = new Date((await session(request)).expires).getTime()
  expect(longExpiry - Date.now()).toBeGreaterThan(29 * 86400000)
  await db.update(sessions).set({ expires: new Date(Date.now() - 60000) }).where(eq(sessions.userId, user.id))
  expect(await session(request)).toBeNull()
  await login(request, email)
  const shortExpiry = new Date((await session(request)).expires).getTime()
  expect(shortExpiry - Date.now()).toBeLessThanOrEqual(8 * 3600000)
  await db.update(users).set({ emailVerified: null }).where(eq(users.id, user.id))
  expect(await session(request)).toBeNull()
})

test("input validation, CSRF, expired links, concurrent token replay and throttling", async ({ request }) => {
  const email = address()
  const input = { name: "Test", email, password, confirmPassword: password, accepted: true }
  expect((await request.post("/api/account/register", { data: input, headers: { Origin: "https://attacker.invalid" } })).status()).toBe(403)
  expect((await request.post("/api/account/register", { data: input })).status()).toBe(403)
  expect((await post(request, "register", { ...input, role: "admin" })).status()).toBe(400)
  expect((await post(request, "register", { ...input, role: "maintenance_staff" })).status()).toBe(400)
  expect((await post(request, "register", { ...input, password: "short" })).status()).toBe(400)
  expect((await request.post("/api/account/register", { data: "{", headers: { Origin: origin, "Content-Type": "application/json" } })).status()).toBe(400)
  expect((await post(request, "register", { ...input, name: "a".repeat(9000) })).status()).toBe(413)
  await register(request, email)
  const first = await latestMail(email, "Verify")
  await db.update(verificationTokens).set({ expires: new Date(Date.now() - 1000) }).where(eq(verificationTokens.token, digest(first.token)))
  expect((await post(request, "verify-email", { token: first.token })).status()).toBe(400)
  expect((await post(request, "resend-verification", { email })).status()).toBe(200)
  const fresh = await latestMail(email, "Verify")
  expect(fresh.token).not.toBe(first.token)
  const responses = await Promise.all([post(request, "verify-email", { token: fresh.token }), post(request, "verify-email", { token: fresh.token })])
  expect(responses.map(r => r.status()).sort()).toEqual([200, 400])
  const known = await (await post(request, "forgot-password", { email })).json()
  const unknown = await (await post(request, "forgot-password", { email: address() })).json()
  expect(known).toEqual(unknown)
  const reset = await latestMail(email, "Reset")
  await db.update(verificationTokens).set({ expires: new Date(Date.now() - 1000) }).where(eq(verificationTokens.token, digest(reset.token)))
  expect((await post(request, "reset-password", { token: reset.token, password, confirmPassword: password })).status()).toBe(400)
  const throttledEmail = address()
  for (let i = 0; i < 5; i++) expect((await post(request, "forgot-password", { email: throttledEmail })).status()).toBe(200)
  expect((await post(request, "forgot-password", { email: throttledEmail })).status()).toBe(429)
  for (let i = 0; i < 11; i++) await login(request, email, "wrong password")
  await login(request, email)
  expect(await session(request)).toBeNull()
  const csrfFailure = await request.post("/api/auth/callback/credentials", { form: { email, password }, headers: { "X-Auth-Return-Redirect": "1" } })
  expect((await csrfFailure.json()).url).toContain("MissingCSRF")
})

test("first-admin bootstrap requires verification and refuses a second administrator", async ({ request }) => {
  const email = address()
  await register(request, email)
  await expect(bootstrapAdministrator(email)).rejects.toThrow("No account promoted")
  await verify(request, email)
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))
  if (existing.length) {
    await expect(bootstrapAdministrator(email)).rejects.toThrow("No account promoted")
  } else {
    await bootstrapAdministrator(email)
    expect((await userFor(email)).role).toBe("admin")
    await expect(bootstrapAdministrator(email)).rejects.toThrow("No account promoted")
    const user = await userFor(email)
    expect(await db.select().from(auditLogs).where(eq(auditLogs.actorId, user.id))).toHaveLength(1)
  }
})
