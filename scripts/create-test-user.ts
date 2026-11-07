/**
 * scripts/create-test-user.ts
 *
 * Creates a verified user directly in the database for development testing.
 * This bypasses the email-verification flow so you can sign in immediately.
 *
 * Usage:
 *   npx tsx scripts/create-test-user.ts <email> <password> [--admin]
 *
 * Example:
 *   npx tsx scripts/create-test-user.ts t.altameme95@gmail.com MyPassword123! --admin
 */
import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"
import { db, users } from "../lib/db"

async function main() {
  const args = process.argv.slice(2)
  const makeAdmin = args.includes("--admin")
  const makeStaff = args.includes("--staff")
  const positional = args.filter((a) => !a.startsWith("--"))

  if (positional.length < 2) {
    console.error("Usage: npx tsx scripts/create-test-user.ts <email> <password> [--admin | --staff]")
    process.exit(1)
  }

  const email = positional[0].trim().toLowerCase()
  const password = positional[1]

  if (password.length < 10) {
    console.error("Password must be at least 10 characters.")
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)

  // Check if user already exists
  const [existing] = await db.select({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified })
    .from(users).where(eq(users.email, email)).limit(1)

  if (existing) {
    console.log(`User ${existing.email} already exists (role=${existing.role}, verified=${!!existing.emailVerified}).`)

    // Update password and ensure verified
    await db.update(users).set({
      password: passwordHash,
      emailVerified: new Date(),
      isActive: true,
      updatedAt: new Date(),
      ...(makeAdmin ? { role: "admin" } : makeStaff ? { role: "maintenance_staff" } : {}),
    }).where(eq(users.id, existing.id))

    console.log(`  → Password updated successfully.`)
    console.log(`  → Email verified: yes`)
    if (makeAdmin) console.log(`  → Role set to admin.`)
    if (makeStaff) console.log(`  → Role set to maintenance_staff.`)
    console.log()
    console.log(`You can now sign in at http://localhost:3000/login`)
    process.exit(0)
  }
  const role = makeAdmin ? "admin" : makeStaff ? "maintenance_staff" : "student"

  const [created] = await db.insert(users).values({
    name: email.split("@")[0],
    email,
    password: passwordHash,
    role: role as "student" | "admin" | "maintenance_staff",
    emailVerified: new Date(),   // Pre-verified for dev
    isActive: true,
  }).returning({ id: users.id, email: users.email, role: users.role })

  console.log(`✅ Created user:`)
  console.log(`   Email:    ${created.email}`)
  console.log(`   Role:     ${created.role}`)
  console.log(`   Verified: yes`)
  console.log(`   Password: (the one you provided)`)
  console.log()
  console.log(`You can now sign in at http://localhost:3000/login`)

  process.exit(0)
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})

