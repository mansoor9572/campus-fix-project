import { defineConfig } from "@playwright/test"
import { existsSync } from "node:fs"
import base from "./playwright.config"
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
export default defineConfig({ ...base, testMatch: "team.spec.ts",
  use: { ...base.use, actionTimeout: 20000, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) } },
})
