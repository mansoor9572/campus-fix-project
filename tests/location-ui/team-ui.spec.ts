import { test, expect, type Page } from "@playwright/test"

const department1 = "11111111-1111-4111-8111-111111111111"
const department2 = "22222222-2222-4222-8222-222222222222"
const worker1 = "33333333-3333-4333-8333-333333333333"
const worker2 = "44444444-4444-4444-8444-444444444444"
const directory = { departments: [{ id: department1, name: "Electrical Services" }, { id: department2, name: "Plumbing Services" }], members: [
  { id: worker1, name: "Same Name", email: "electrical@example.invalid", departmentId: department1, departmentName: "Electrical Services", role: "maintenance_staff", isActive: true, mustChangePassword: false, openTasks: 2 },
  { id: worker2, name: "Same Name", email: "plumbing@example.invalid", departmentId: department2, departmentName: "Plumbing Services", role: "maintenance_staff", isActive: true, mustChangePassword: false, openTasks: 1 },
  { id: "55555555-5555-4555-8555-555555555555", name: "Inactive worker", email: "inactive@example.invalid", departmentId: department1, role: "maintenance_staff", isActive: false, openTasks: 0 },
] }
const report = { id: "RPT-9001", title: "Broken classroom light", description: "The classroom light is flickering.", building: "Engineering", room: "201",
  category: "Electrical", status: "Submitted", priority: "Medium", reporterName: "Student", reporterEmail: "student@example.invalid", reporterProgram: "Engineering",
  assignedTo: null, assignedStaffId: null, department: "Electrical Services", departmentId: department1,
  createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z", images: [], updates: [] }

async function mock(page: Page, fail = false) {
  const saved: Record<string, unknown>[] = []
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { id: "11111111-1111-4111-8111-111111111111", name: "Location Test", email: "location@example.invalid", role: "admin" }, expires: "2099-01-01T00:00:00Z" } })
    if (path === "/api/admin/team") {
      if (route.request().method() === "POST") { saved.push(route.request().postDataJSON()); return route.fulfill({ status: 201, json: { message: "Account created." } }) }
      return route.fulfill({ json: directory })
    }
    if (path === "/api/reports/RPT-9001" && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON(); saved.push(body)
      return fail ? route.fulfill({ status: 409, json: { message: "Worker is no longer available." } }) : route.fulfill({ json: { ...report, ...body, status: "Assigned", assignedTo: "Same Name", updatedAt: "2026-11-09T00:01:00Z" } })
    }
    if (path === "/api/reports") return route.fulfill({ json: { reports: [report] } })
    if (path === "/api/reports/stats") return route.fulfill({ json: null })
    if (path === "/api/reference-data") return route.fulfill({ json: { departments: directory.departments, buildings: [], categories: [{ id: department1, name: "Electrical" }], staff: directory.members } })
    return route.fulfill({ json: [] })
  })
  return saved
}

test("assignment filters active workers by department and sends IDs", async ({ page }) => {
  const saved = await mock(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin/reports/RPT-9001")
  const worker = page.getByLabel("Assign worker", { exact: true })
  await expect(worker.locator("option")).toHaveCount(2)
  await expect(worker).toContainText("electrical@example.invalid")
  await expect(worker).not.toContainText("plumbing@example.invalid")
  await worker.selectOption(worker1)
  await page.getByLabel("Responsible department").selectOption(department2)
  await expect(worker).toHaveValue("")
  await expect(worker).toContainText("plumbing@example.invalid")
  await worker.selectOption(worker2)
  await page.getByRole("button", { name: "Assign work", exact: true }).click()
  await expect(page.getByText("Work assigned. The worker has been notified.", { exact: true })).toBeVisible()
  expect(saved[0]).toMatchObject({ departmentId: department2, assignedStaffId: worker2 })
  expect(saved[0]).not.toHaveProperty("assignedTo")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("failed assignment preserves the report and shows no success message", async ({ page }) => {
  await mock(page, true)
  await page.goto("/admin/reports/RPT-9001")
  await page.getByLabel("Assign worker", { exact: true }).selectOption(worker1)
  await page.getByRole("button", { name: "Assign work", exact: true }).click()
  await expect(page.getByText("Worker is no longer available.", { exact: true })).toBeVisible()
  await expect(page.getByText("Work assigned. The worker has been notified.", { exact: true })).toHaveCount(0)
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Submitted")
})

test("administrator creation explains access and requires confirmation", async ({ page }) => {
  const saved = await mock(page)
  await page.goto("/admin/team")
  await page.getByRole("button", { name: "Administrators", exact: true }).click()
  await page.getByRole("button", { name: "Add administrator", exact: true }).click()
  await page.getByLabel("Full name", { exact: true }).fill("New Admin")
  await page.getByLabel("Email address", { exact: true }).fill("newadmin@example.invalid")
  await page.getByLabel("Temporary password", { exact: true }).fill("Temporary password 42!")
  await page.getByRole("button", { name: "Create account", exact: true }).click()
  expect(saved).toHaveLength(0)
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: "Create account", exact: true }).click()
  await expect(page.getByText("Account sign-in details", { exact: true })).toBeVisible()
  expect(saved[0]).toMatchObject({ role: "admin", departmentId: null, email: "newadmin@example.invalid" })
  await page.getByRole("button", { name: "Dismiss sign-in details" }).click()
  await expect(page.getByText("Temporary password 42!", { exact: true })).toHaveCount(0)
})
