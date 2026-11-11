import { test, expect, type Page } from "@playwright/test"

async function mock(page: Page, status: number) {
  let changes = 0
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { id: "11111111-1111-4111-8111-111111111111", name: "Worker", email: "worker@example.invalid", role: "maintenance_staff", mustChangePassword: true }, expires: "2099-01-01T00:00:00Z" } })
    if (path === "/api/account/change-initial-password") {
      changes++
      return route.fulfill({ status, json: { message: status === 401 ? "Authentication required." : status === 400 ? "Your passwords do not match." : "Password changed." } })
    }
    if (path === "/api/auth/signout") return route.abort()
    if (path === "/api/reports") return route.fulfill({ json: { reports: [] } })
    if (path === "/api/reference-data") return route.fulfill({ json: { buildings: [], departments: [], categories: [], staff: [] } })
    return route.fulfill({ json: null })
  })
  return () => changes
}
async function fill(page: Page) {
  await page.goto("/change-password")
  await page.getByLabel("Temporary password", { exact: true }).fill("Temporary password 42!")
  await page.getByLabel("New password", { exact: true }).fill("Personal password 73!")
  await page.getByLabel("Confirm new password", { exact: true }).fill("Personal password 73!")
  await page.getByRole("button", { name: "Change password", exact: true }).click()
}

test("revoked session replaces the stale form with sign-in recovery", async ({ page }) => {
  await mock(page, 401)
  await fill(page)
  await expect(page.getByRole("heading", { name: "Sign in again to continue" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in again", exact: true })).toHaveAttribute("href", "/login")
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

test("successful save is clear even when the sign-out endpoint is unavailable", async ({ page }) => {
  const changes = await mock(page, 200)
  await fill(page)
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in with new password" })).toHaveAttribute("href", "/login")
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toHaveCount(0)
  expect(changes()).toBe(1)
})

test("validation failures keep the form available for correction", async ({ page }) => {
  await mock(page, 400)
  await fill(page)
  await expect(page.getByText("Your passwords do not match.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toBeEnabled()
})
