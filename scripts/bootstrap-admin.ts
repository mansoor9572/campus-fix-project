import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL
  if (!email) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL to the existing verified student's email. No password is accepted by this command.")
  const { bootstrapAdministrator } = await import("../lib/auth/bootstrap")
  await bootstrapAdministrator(email)
  console.log("First administrator promoted and audited. Sign in again to continue.")
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Administrator bootstrap failed."); process.exitCode = 1 })
