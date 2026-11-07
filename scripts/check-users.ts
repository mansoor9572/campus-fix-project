import { db, users } from "../lib/db"

async function main() {
  const rows = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    verified: users.emailVerified,
    active: users.isActive,
    password: users.password,
  }).from(users)

  for (const r of rows) {
    console.log(`  ${r.email} | role=${r.role} | verified=${!!r.verified} | active=${r.active} | hasPassword=${!!r.password}`)
  }
  console.log(`Total: ${rows.length} users`)
  process.exit(0)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})

