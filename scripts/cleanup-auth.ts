import { config } from "dotenv"
import { sql } from "drizzle-orm"
config({ path: ".env.local", quiet: true })

async function main() {
  const { db } = await import("../lib/db")
  // Only expired auth artifacts in owned namespaces; no users/reference/report data.
  await db.execute(sql`DELETE FROM verification_tokens WHERE expires < now() AND (identifier LIKE 'rate:%' OR identifier LIKE 'verify:%' OR identifier LIKE 'reset:%')`)
  await db.execute(sql`DELETE FROM sessions WHERE expires < now()`)
  console.log("Expired authentication artifacts removed.")
}
main().catch(() => { console.error("Authentication cleanup failed."); process.exitCode = 1 })
