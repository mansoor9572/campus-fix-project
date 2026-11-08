import { test, expect, type Page } from "@playwright/test"
import { UMY_BUILDINGS } from "../../lib/buildings/directory"

const buildings = UMY_BUILDINGS.map((entry, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, code: null,
  faculty: null, description: "Location details awaiting facilities confirmation.", mapsUrl: null, latitude: null, longitude: null,
  sourceUrl: null, verificationStatus: "unverified", isActive: true, ...entry }))
const categoryId = "22222222-2222-4222-8222-222222222222"
const report = { id: "RPT-9001", title: "Leaking air conditioner", description: "Water is leaking near the laboratory entrance.",
  building: "Engineering Building F6", buildingId: buildings.find(building => building.code === "F6")!.id,
  room: "F6.201", floor: "2nd Floor", roomNumber: "F6.201", additionalDetails: "Near the elevator",
  category: "HVAC", status: "In Progress", priority: "Medium", reporterName: "Location Test", reporterEmail: "location@example.invalid",
  reporterProgram: "Engineering", assignedTo: "Location Test", department: "Facilities Services",
  createdAt: "2026-11-07T10:00:00Z", updatedAt: "2026-11-07T10:00:00Z", images: [], updates: [] }

async function mockApi(page: Page, options: { failSave?: boolean; existing?: boolean; failDirectory?: boolean } = {}) {
  const posted: Record<string, unknown>[] = []
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (url.pathname === "/api/auth/session") return route.fulfill({ json: { user: { id: "11111111-1111-4111-8111-111111111111", name: "Location Test", email: "location@example.invalid", role: page.url().includes("/admin") ? "admin" : page.url().includes("/staff") ? "maintenance_staff" : "student" }, expires: "2099-01-01T00:00:00Z" } })
    if (url.pathname === "/api/buildings") {
      if (options.failDirectory) return route.fulfill({ status: 503, json: { message: "Unavailable" } })
      if (method === "POST") return route.fulfill({ status: 201, json: { id: "test-new", ...route.request().postDataJSON() } })
      return route.fulfill({ json: buildings })
    }
    if (url.pathname === "/api/reference-data") return route.fulfill({ json: { buildings, categories: [{ id: categoryId, name: "HVAC" }], departments: [], staff: [] } })
    if (url.pathname === "/api/reports" && method === "POST") {
      const payload = route.request().postDataJSON(); posted.push(payload)
      if (options.failSave) return route.fulfill({ status: 500, json: { message: "Unable to save report. Please try again." } })
      return route.fulfill({ status: 201, json: { ...report, ...payload, id: "RPT-9002", status: "Submitted" } })
    }
    if (url.pathname === "/api/reports") return route.fulfill({ json: { reports: options.existing ? [report, { ...report, id: "RPT-9000", title: "Legacy location report", floor: null, roomNumber: null, additionalDetails: null, room: "east stairwell, 2nd floor" }] : [] } })
    if (url.pathname === "/api/reports/stats") return route.fulfill({ json: { total: 0, pending: 0, inProgress: 0, resolved: 0, urgent: 0, resolutionRate: 0, avgResolutionHours: null, byCategory: [], byBuilding: [], byPriority: [], workload: [] } })
    return route.fulfill({ json: [] })
  })
  return posted
}

async function fillIssue(page: Page) {
  await page.getByLabel("What needs attention?").fill("Leaking air conditioner")
  await page.getByLabel("Category", { exact: false }).first().selectOption("HVAC")
  await page.getByRole("combobox", { name: "Building" }).fill("F6")
  await page.getByRole("option", { name: /Engineering Building F6/ }).click()
  await page.getByLabel("Tell us a little more").fill("Water is leaking near the laboratory entrance.")
}

test("dropdown opens all supplied buildings and can search or change a selection", async ({ page }) => {
  await mockApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Show all buildings" }).click()
  const list = page.getByRole("listbox", { name: "Matching buildings" })
  await expect(list.getByRole("option")).toHaveCount(27)
  await page.screenshot({ path: "docs/screenshots/umy-building-dropdown-desktop.png", fullPage: true })
  await list.getByRole("option", { name: /Engineering Building F6/ }).click()
  const field = page.getByRole("combobox", { name: "Building" })
  await expect(field).toHaveValue("Engineering Building F6")
  await page.getByRole("button", { name: "Show all buildings" }).click()
  await expect(list.getByRole("option")).toHaveCount(27)
  await expect(list.getByRole("option", { name: /Engineering Building F6/ })).toHaveAttribute("aria-selected", "true")
  await field.fill("perpustakaan")
  await expect(list.getByRole("option")).toHaveCount(1)
  await list.getByRole("option", { name: /UMY Library/ }).click()
  await expect(field).toHaveValue("UMY Library")
  await page.getByRole("button", { name: "Show all buildings" }).click()
  await page.getByRole("button", { name: "Close building list" }).click()
  await expect(field).toHaveValue("UMY Library")
})

test("building search, clear, no-results and keyboard selection", async ({ page }) => {
  await mockApi(page)
  await page.goto("/")
  const search = page.getByRole("combobox", { name: "Building" })
  for (const query of ["F1", "F3", "F4", "F6", "Engineering", "Fakultas Teknik", "FISIPOL", "Fachruddin", "Ibrahim", "Perpustakaan", "Library", "Sportorium", "Masjid", "Dormitory", "Asrama"]) {
    await search.fill(query)
    await expect(page.getByRole("listbox", { name: "Matching buildings" }).getByRole("option").first()).not.toHaveAttribute("aria-disabled", "true")
    await expect(page.getByRole("listbox", { name: "Matching buildings" }).getByRole("option").first()).toBeVisible()
  }
  await search.fill("nothing-matches-999")
  await expect(page.getByText("No buildings match.", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Clear building selection" }).click()
  await expect(search).toHaveValue("")
  await search.fill("f6")
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await page.screenshot({ path: "docs/screenshots/umy-building-search-desktop.png", fullPage: true })
  await search.press("ArrowDown")
  await search.press("Enter")
  await expect(search).toHaveValue("Engineering Building F6")
  await expect(page.getByLabel("Floor", { exact: false }).first()).toHaveAttribute("type", "text")
  await expect(page.getByLabel("Room Number", { exact: false })).toHaveAttribute("type", "text")
})

test("required location validation and exact create payload; details may be empty", async ({ page }) => {
  const posted = await mockApi(page)
  await page.goto("/")
  await fillIssue(page)
  await page.getByRole("button", { name: "Submit report" }).click()
  await expect(page.getByText("Enter a floor number or name (up to 60 characters).")).toBeVisible()
  await expect(page.getByText("Enter a room number or name (up to 100 characters).")).toBeVisible()
  expect(posted).toHaveLength(0)
  await page.getByLabel("Floor", { exact: false }).first().fill(" Basement ")
  await page.getByLabel("Room Number", { exact: false }).fill(" Laboratory 3 ")
  await page.getByRole("button", { name: "Submit report" }).click()
  await expect(page).toHaveURL(/\/student\/reports$/)
  expect(posted[0]).toMatchObject({ buildingId: report.buildingId, floor: "Basement", roomNumber: "Laboratory 3", additionalDetails: "", categoryId })
  expect(posted[0]).not.toHaveProperty("room")
})

test("mobile layout and failed persistence keep entered location on form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const posted = await mockApi(page, { failSave: true })
  await page.goto("/")
  await fillIssue(page)
  await page.getByLabel("Floor", { exact: false }).first().fill("2nd Floor")
  await page.getByLabel("Room Number", { exact: false }).fill("F6.201")
  await page.getByLabel("Additional Details", { exact: false }).fill("Near the elevator")
  await expect(page.getByLabel("Floor", { exact: false }).first()).toHaveAttribute("maxlength", "60")
  await expect(page.getByLabel("Room Number", { exact: false })).toHaveAttribute("maxlength", "100")
  await expect(page.getByLabel("Additional Details", { exact: false })).toHaveAttribute("maxlength", "500")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await page.screenshot({ path: "docs/screenshots/report-location-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Submit report" }).click()
  await expect(page.locator(".auth-error")).toContainText("Unable to save report")
  expect(posted[0].additionalDetails).toBe("Near the elevator")
  await expect(page.getByLabel("Room Number", { exact: false })).toHaveValue("F6.201")
  await expect(page).not.toHaveURL(/\/student\/reports$/)
})

test("location and legacy text appear in student, admin and maintenance details", async ({ page }) => {
  await mockApi(page, { existing: true })
  for (const route of ["/student/reports/RPT-9001", "/admin/reports/RPT-9001", "/staff/tasks/RPT-9001"]) {
    await page.goto(route)
    await expect(page.getByText(/2nd Floor · F6.201 · Near the elevator/).first()).toBeVisible()
  }
  await page.goto("/student/reports/RPT-9000")
  await expect(page.getByText(/east stairwell, 2nd floor/).first()).toBeVisible()
})

test("admin directory labels unverified entries and offers building metadata only", async ({ page }) => {
  await mockApi(page)
  await page.goto("/admin/buildings")
  await page.getByLabel("Search building directory").fill("F6")
  await expect(page.getByText("unverified · Active")).toBeVisible()
  await page.getByRole("button", { name: "Edit Engineering Building F6" }).click()
  await expect(page.getByLabel("Building code (if known)")).toHaveValue("F6")
  await expect(page.getByLabel("Alternative names", { exact: false })).toContainText("Fakultas Teknik")
  await expect(page.getByLabel("Room Number", { exact: false })).toHaveCount(0)
})

test("directory load failure shows retry and cannot submit an arbitrary building", async ({ page }) => {
  const posted = await mockApi(page, { failDirectory: true })
  await page.goto("/")
  await expect(page.getByText("Unable to load the building directory.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
  await page.getByRole("combobox", { name: "Building" }).fill("Invented building")
  await page.getByRole("button", { name: "Submit report" }).click()
  await expect(page.getByText("Search and select a building from the directory.")).toBeVisible()
  expect(posted).toHaveLength(0)
})
