import { defineConfig } from "@playwright/test"
import { existsSync } from "node:fs"
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
export default defineConfig({
  testDir: "./tests/location-ui", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3101", headless: true, trace: "off", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) } },
  webServer: { command: "node scripts/location-ui-server.mjs", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 120000 },
})
