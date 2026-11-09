import { test, expect, type APIRequestContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { hash, compare } from "bcryptjs"
import { eq, inArray, sql } from "drizzle-orm"
import { db, users, reports, departments, buildings, auditLogs, reportAssignments, reportStatusHistory } from "../../lib/db"

const origin = "http://127.0.0.1:3100"
const temporary = "Temporary team password 42!"
const permanent = "My personal team password 73!"
const suffix = randomUUID()
const email = (label: string) => `team-test-${suffix}-${label}@example.invalid`
const departmentIds: string[] = [], buildingIds: string[] = [], reportIds: string[] = []

async function login(request: APIRequestContext, address: string, password = temporary) {
  const csrfToken = (await (await request.get("/api/auth/csrf")).json()).csrfToken
  await request.post("/api/auth/callback/credentials", { form: { email: address, password, csrfToken }, headers: { Origin: origin, "X-Auth-Return-Redirect": "1" } })
  return (await request.get("/api/auth/session")).json()
}
async function mutate(request: APIRequestContext, path: string, data: unknown, method = "POST") {
  return request.fetch(path, { method, data, headers: { Origin: origin } })
}
async function detail(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/reports/${id}`)
  expect(response.status()).toBe(200)
  return response.json()
}

test.afterAll(async () => {
  const created = await db.select({ id: users.id }).from(users).where(sql`email LIKE ${`team-test-${suffix}-%@example.invalid`}`)
  if (reportIds.length) await db.delete(reports).where(inArray(reports.id, reportIds))
  if (created.length) {
    const ids = created.map(user => user.id)
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, ids))
    await db.delete(users).where(inArray(users.id, ids))
  }
  if (buildingIds.length) await db.delete(buildings).where(inArray(buildings.id, buildingIds))
  if (departmentIds.length) await db.delete(departments).where(inArray(departments.id, departmentIds))
})

test("admin provisions accounts, enforces first-login password change, and assigns department-scoped work", async ({ playwright, page }) => {
  test.setTimeout(300000)
  const [admin, student] = await db.insert(users).values([
    { name: "Team Test Admin", email: email("admin"), role: "admin", password: await hash(temporary, 12), emailVerified: new Date() },
    { name: "Team Test Student", email: email("student"), role: "student", password: await hash(temporary, 12), emailVerified: new Date() },
  ]).returning()
  const depts = await db.insert(departments).values([{ name: `Team Electrical ${suffix}` }, { name: `Team Plumbing ${suffix}` }]).returning()
  departmentIds.push(...depts.map(dept => dept.id))
  const [building] = await db.insert(buildings).values({ name: `Team Test Building ${suffix}` }).returning()
  buildingIds.push(building.id)
  const [report] = await db.insert(reports).values({ referenceNumber: `RPT-${suffix}`, title: "Test broken classroom light", description: "Test fixture for department assignment.", studentId: student.id, buildingId: building.id }).returning()
  reportIds.push(report.id)
  const adminClient = page.request
  expect((await login(adminClient, admin.email)).user.role).toBe("admin")
  const workerClient = await playwright.request.newContext({ baseURL: origin })
  const studentClient = await playwright.request.newContext({ baseURL: origin })
  const otherAdminClient = await playwright.request.newContext({ baseURL: origin })
  try {
    expect((await workerClient.get("/api/admin/team")).status()).toBe(401)
    await login(studentClient, student.email)
    expect((await studentClient.get("/api/admin/team")).status()).toBe(403)
    expect((await mutate(studentClient, "/api/admin/team", {})).status()).toBe(403)
    expect((await adminClient.post("/api/admin/team", { data: {}, headers: { Origin: "https://other.invalid" } })).status()).toBe(403)

    // Real UI creates the worker; the password is never returned by the API.
    await page.goto("/admin/team")
    await page.getByRole("button", { name: "Add worker", exact: true }).click()
    await page.getByLabel("Full name", { exact: true }).fill("Same Worker Name")
    await page.getByLabel("Email address", { exact: true }).fill(email("worker"))
    await page.getByLabel("Department", { exact: true }).selectOption(depts[0].id)
    await page.getByLabel("Temporary password", { exact: true }).fill(temporary)
    await page.getByRole("button", { name: "Create account", exact: true }).click()
    await expect(page.getByText("Account sign-in details", { exact: true })).toBeVisible()
    const [worker] = await db.select().from(users).where(eq(users.email, email("worker")))
    expect(worker.role).toBe("maintenance_staff")
    expect(worker.departmentId).toBe(depts[0].id)
    expect(await compare(temporary, worker.password!)).toBe(true)
    expect(worker.emailVerified).toBeNull()
    const directory = await (await adminClient.get("/api/admin/team")).json()
    expect(directory.members.every((member: object) => !Object.hasOwn(member, "password"))).toBe(true)
    expect((await mutate(adminClient, "/api/admin/team", { name: "Duplicate", email: ` ${worker.email.toUpperCase()} `, role: "admin", password: temporary })).status()).toBe(409)

    expect((await login(workerClient, worker.email)).user.mustChangePassword).toBe(true)
    expect((await workerClient.get("/api/reports")).status()).toBe(403)
    expect((await workerClient.get("/api/admin/team")).status()).toBe(403)
    const restricted = await workerClient.get("/staff/dashboard", { maxRedirects: 0 })
    expect(restricted.headers().location).toBe("/change-password")
    expect((await mutate(workerClient, "/api/account/change-initial-password", { currentPassword: temporary, password: temporary, confirmPassword: temporary })).status()).toBe(400)
    expect((await mutate(workerClient, "/api/account/change-initial-password", { currentPassword: temporary, password: permanent, confirmPassword: permanent })).status()).toBe(200)
    expect((await workerClient.get("/api/reports")).status()).toBe(401)
    expect((await login(workerClient, worker.email, permanent)).user.mustChangePassword).toBe(false)
    expect((await workerClient.get("/api/admin/team")).status()).toBe(403)
    expect((await workerClient.get(`/api/reports/${report.id}`)).status()).toBe(403)

    const makeOther = await mutate(adminClient, "/api/admin/team", { name: "Same Worker Name", email: email("worker2"), role: "maintenance_staff", departmentId: depts[1].id, password: temporary })
    expect(makeOther.status()).toBe(201)
    const worker2 = await makeOther.json()
    let current = await detail(adminClient, report.id)
    expect((await mutate(adminClient, `/api/reports/${report.id}`, { version: current.version, departmentId: depts[0].id, assignedStaffId: worker2.id }, "PATCH")).status()).toBe(409)
    expect((await db.select().from(reportAssignments).where(eq(reportAssignments.reportId, report.id))).length).toBe(0)
    const assigned = await mutate(adminClient, `/api/reports/${report.id}`, { version: current.version, departmentId: depts[0].id, assignedStaffId: worker.id }, "PATCH")
    expect(assigned.status(), await assigned.text()).toBe(200)
    current = await detail(adminClient, report.id)
    expect(current.status).toBe("Assigned")
    expect(current.assignedStaffId).toBe(worker.id)
    expect((await workerClient.get(`/api/reports/${report.id}`)).status()).toBe(200)
    const notices = await (await workerClient.get("/api/notifications")).json()
    expect(notices.some((notice: { title: string }) => notice.title === "New work order assigned")).toBe(true)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { departmentId: depts[1].id }, "PATCH")).status()).toBe(409)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { isActive: false }, "PATCH")).status()).toBe(409)
    expect((await mutate(workerClient, `/api/reports/${report.id}`, { version: current.version, assignedStaffId: worker2.id }, "PATCH")).status()).toBe(403)
    expect((await mutate(workerClient, `/api/reports/${report.id}`, { version: current.version, title: "Altered student report" }, "PATCH")).status()).toBe(403)
    expect((await mutate(workerClient, `/api/reports/${report.id}`, { version: current.version, status: "resolved" }, "PATCH")).status()).toBe(400)
    expect((await mutate(workerClient, `/api/reports/${report.id}`, { version: current.version, status: "in_progress" }, "PATCH")).status()).toBe(200)
    current = await detail(workerClient, report.id)
    expect((await mutate(workerClient, `/api/reports/${report.id}/notes`, { version: current.version, message: "Checked the circuit and replaced the lamp.", isPublic: true })).status()).toBe(201)
    current = await detail(workerClient, report.id)
    expect((await mutate(workerClient, `/api/reports/${report.id}`, { version: current.version, status: "resolved" }, "PATCH")).status()).toBe(200)
    expect((await db.select().from(reportAssignments).where(eq(reportAssignments.reportId, report.id)))[0].status).toBe("completed")

    // Reassignment changes visibility and stale concurrent writes have no side effects.
    current = await detail(adminClient, report.id)
    expect((await mutate(adminClient, `/api/reports/${report.id}`, { version: current.version, status: "reopened" }, "PATCH")).status()).toBe(200)
    current = await detail(adminClient, report.id)
    const simultaneous = await Promise.all([
      mutate(adminClient, `/api/reports/${report.id}`, { version: current.version, departmentId: depts[1].id, assignedStaffId: worker2.id }, "PATCH"),
      mutate(adminClient, `/api/reports/${report.id}`, { version: current.version, departmentId: depts[1].id, assignedStaffId: worker2.id }, "PATCH"),
    ])
    expect(simultaneous.map(response => response.status()).sort()).toEqual([200, 409])
    expect((await workerClient.get(`/api/reports/${report.id}`)).status()).toBe(403)
    const history = await db.select().from(reportStatusHistory).where(eq(reportStatusHistory.reportId, report.id))
    expect(history.filter(row => row.newStatus === "assigned")).toHaveLength(2)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { departmentId: depts[1].id }, "PATCH")).status()).toBe(200)
    await login(workerClient, worker.email, permanent)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { isActive: false }, "PATCH")).status()).toBe(200)
    expect((await workerClient.get("/api/reports")).status()).toBe(401)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { isActive: true }, "PATCH")).status()).toBe(200)
    expect((await mutate(adminClient, `/api/admin/team/${worker.id}`, { password: temporary }, "PATCH")).status()).toBe(200)
    expect((await login(workerClient, worker.email)).user.mustChangePassword).toBe(true)

    const secondAdmin = await mutate(adminClient, "/api/admin/team", { name: "Second Test Admin", email: email("admin2"), role: "admin", password: temporary })
    expect(secondAdmin.status()).toBe(201)
    expect((await login(otherAdminClient, email("admin2"))).user.mustChangePassword).toBe(true)
    expect((await otherAdminClient.get("/api/admin/team")).status()).toBe(403)
    expect((await mutate(otherAdminClient, "/api/account/change-initial-password", { currentPassword: temporary, password: permanent, confirmPassword: permanent })).status()).toBe(200)
    expect((await login(otherAdminClient, email("admin2"), permanent)).user.role).toBe("admin")
    expect((await otherAdminClient.get("/api/admin/team")).status()).toBe(200)
    expect((await mutate(adminClient, `/api/admin/team/${admin.id}`, { isActive: false }, "PATCH")).status()).toBe(400)

    // Migration preserves work already assigned before department membership existed.
    const [legacy] = await db.insert(users).values({ name: "Legacy Worker", email: email("legacy"), role: "maintenance_staff", password: await hash(permanent, 12), emailVerified: new Date() }).returning()
    const [legacyReport] = await db.insert(reports).values({ referenceNumber: `RPT-legacy-${suffix}`, title: "Existing task before migration", description: "Legacy assigned task fixture.", studentId: student.id, buildingId: building.id, assignedStaffId: legacy.id, status: "assigned" }).returning()
    reportIds.push(legacyReport.id)
    await login(workerClient, legacy.email, permanent)
    let legacyTask = await detail(workerClient, legacyReport.id)
    expect((await mutate(workerClient, `/api/reports/${legacyReport.id}`, { version: legacyTask.version, status: "in_progress" }, "PATCH")).status()).toBe(200)
    legacyTask = await detail(workerClient, legacyReport.id)
    expect((await mutate(workerClient, `/api/reports/${legacyReport.id}`, { version: legacyTask.version, status: "resolved" }, "PATCH")).status()).toBe(200)
  } finally { await workerClient.dispose(); await studentClient.dispose(); await otherAdminClient.dispose() }
})
