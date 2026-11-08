import { config } from "dotenv"
import { spawnSync } from "node:child_process"
config({ path: ".env.local", quiet: true })

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL
  if (!testUrl) {
    console.log("SKIPPED database integration tests: set TEST_DATABASE_URL to a separate Neon test branch. Production was not accessed.")
    process.exit(0)
  }
  const target = new URL(testUrl)
  const primary = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
  const endpoint = (url: URL) => url.hostname.replace("-pooler.", ".")
  if (!target.hostname.endsWith(".neon.tech") || (primary && endpoint(target) === endpoint(primary))) {
    console.error("TEST_DATABASE_URL must use a different Neon branch endpoint from DATABASE_URL.")
    process.exit(1)
  }
  // Every child receives the test branch explicitly; dotenv never overrides it.
  process.env.DATABASE_URL = testUrl
  process.env.GEMINI_API_KEY = ""
  const { db } = await import("../lib/db")
  const { migrate } = await import("drizzle-orm/neon-http/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  for (const args of [["scripts/seed.ts"], ["scripts/seed-umy-buildings.ts", "--apply"], ["--test", "tests/reports.integration.test.ts", "tests/buildings.integration.test.ts"]]) {
    const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", ...args], { stdio: "inherit", env: process.env })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }

}
main().catch(() => { console.error("Test branch preparation failed; check TEST_DATABASE_URL and migration status."); process.exitCode = 1 })
