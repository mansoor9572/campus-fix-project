import { defineConfig } from "@playwright/test"
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: false,
  workers: 1,
  timeout: 240000,
  expect: { timeout: 45000 },
  use: { baseURL: "http://127.0.0.1:3100", headless: true, trace: "off", screenshot: "off", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: "node scripts/auth-test-server.mjs", url: "http://127.0.0.1:3100/login", reuseExistingServer: false, timeout: 120000 },
})
