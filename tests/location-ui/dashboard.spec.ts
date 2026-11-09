import { test, expect, type Page } from "@playwright/test"

const report = {
  id: "RPT-9001", title: "Leaking air conditioner", description: "Water near the entrance.",
  building: "Engineering Building F6", room: "201", category: "HVAC",
  status: "Submitted", priority: "Medium", reporterName: "Location Test",
  reporterEmail: "location@example.invalid", reporterProgram: "Engineering",
  assignedTo: null, department: null, images: [],
  createdAt: "2026-11-07T10:00:00Z", updatedAt: "2026-11-07T10:00:00Z",
}

async function mockDashboard(page: Page, reports: unknown[], failReports = false) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/session") return route.fulfill({ json: {
      user: { id: "11111111-1111-4111-8111-111111111111", name: "Location Test", email: report.reporterEmail, role: "student" },
      expires: "2099-01-01T00:00:00Z",
    } })
    if (path === "/api/reports") return route.fulfill({ status: failReports ? 500 : 200, json: { reports } })
    if (path === "/api/reference-data") return route.fulfill({ json: { buildings: [], categories: [], departments: [], staff: [] } })
    if (path === "/api/reports/stats") return route.fulfill({ json: null })
    return route.fulfill({ json: [] })
  })
}

test("mobile dashboard survives a report response without history", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await mockDashboard(page, [report])
  await page.goto("/student/dashboard")
  await expect(page.getByRole("heading", { name: "Good morning, Location" })).toBeVisible()
  await expect(page.getByRole("link", { name: report.title, exact: true })).toBeVisible()
  await expect(page.getByText("Demo workspace", { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("dashboard renders the history supplied by the API", async ({ page }) => {
  await mockDashboard(page, [{ ...report, updates: [{ id: "history-1", createdAt: report.createdAt,
    actor: "Campus Operations", title: "Report submitted", message: "Your report was received." }] }])
  await page.goto("/student/dashboard")
  await expect(page.getByText("Report submitted", { exact: true })).toBeVisible()
})

test("empty notifications do not leave sample notifications behind", async ({ page }) => {
  await mockDashboard(page, [])
  await page.goto("/student/notifications")
  await expect(page.getByText("No notifications yet", { exact: true })).toBeVisible()
  await expect(page.getByText("Demo workspace", { exact: true })).toHaveCount(0)
})

test("failed report requests show an error instead of silently using demo data", async ({ page }) => {
  await mockDashboard(page, [], true)
  await page.goto("/student/dashboard")
  await expect(page.getByText("Failed to load reports. Please reload to try again.", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Good morning, Location" })).toBeVisible()
})
