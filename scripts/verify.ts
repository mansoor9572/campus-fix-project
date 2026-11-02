import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../lib/db/schema"

async function verify() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.")
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })
  let passed = 0
  let failed = 0

  function check(name: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`)
      failed++
    }
  }

  // ─── 1. Table existence ──────────────────────────────────────────────────
  console.log("\n🔍 1. Verifying table existence...")
  const expectedTables = [
    "users", "accounts", "sessions", "verification_tokens",
    "buildings", "departments", "facility_categories",
    "reports", "report_images", "ai_analyses",
    "report_status_history", "report_assignments",
    "notifications", "audit_logs",
  ]

  const tablesResult = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `
  const existingTables = tablesResult.map((r) => r.table_name)

  for (const table of expectedTables) {
    check(`Table "${table}" exists`, existingTables.includes(table))
  }

  // ─── 2. Enum types ──────────────────────────────────────────────────────
  console.log("\n🔍 2. Verifying enum types...")
  const enumsResult = await sql`
    SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
    FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    GROUP BY typname ORDER BY typname
  `

  const expectedEnums: Record<string, string[]> = {
    user_role: ["student", "admin", "maintenance_staff"],
    report_status: ["submitted", "under_review", "approved", "assigned", "in_progress", "resolved", "closed", "rejected", "reopened"],
    priority: ["low", "medium", "high"],
    ai_review_status: ["pending", "accepted", "corrected", "rejected"],
    assignment_status: ["active", "completed", "reassigned", "cancelled"],
    notification_type: ["report_submitted", "report_reviewed", "report_assigned", "status_update", "report_resolved", "report_rejected", "system"],
  }

  for (const [enumName, expectedValues] of Object.entries(expectedEnums)) {
    const found = enumsResult.find((r) => r.typname === enumName)
    if (!found) {
      check(`Enum "${enumName}" exists`, false)
    } else {
      const rawValues = found.values
      const actualValues: string[] = Array.isArray(rawValues) ? rawValues : typeof rawValues === 'string' ? rawValues.replace(/[{}]/g, '').split(',') : []
      const matches = expectedValues.length === actualValues.length && expectedValues.every((v) => actualValues.includes(v))
      check(`Enum "${enumName}" has correct values (${expectedValues.length})`, matches, matches ? undefined : `got: ${actualValues.join(", ")}`)
    }
  }

  // ─── 3. Foreign keys ─────────────────────────────────────────────────────
  console.log("\n🔍 3. Verifying foreign keys...")
  const fksResult = await sql`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name,
           ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `
  check(`Foreign keys exist (found ${fksResult.length})`, fksResult.length >= 20)

  const criticalFks = [
    { table: "reports", column: "student_id", ref: "users" },
    { table: "reports", column: "building_id", ref: "buildings" },
    { table: "reports", column: "category_id", ref: "facility_categories" },
    { table: "reports", column: "assigned_staff_id", ref: "users" },
    { table: "report_images", column: "report_id", ref: "reports" },
    { table: "ai_analyses", column: "report_id", ref: "reports" },
    { table: "report_status_history", column: "report_id", ref: "reports" },
    { table: "report_assignments", column: "report_id", ref: "reports" },
    { table: "notifications", column: "recipient_id", ref: "users" },
    { table: "accounts", column: "user_id", ref: "users" },
    { table: "sessions", column: "user_id", ref: "users" },
    { table: "facility_categories", column: "default_department_id", ref: "departments" },
  ]

  for (const fk of criticalFks) {
    const exists = fksResult.some((r) => r.table_name === fk.table && r.column_name === fk.column && r.foreign_table_name === fk.ref)
    check(`FK ${fk.table}.${fk.column} → ${fk.ref}`, exists)
  }

  // ─── 4. Unique constraints / indexes ──────────────────────────────────────
  console.log("\n🔍 4. Verifying unique constraints and indexes...")
  const indexResult = await sql`
    SELECT indexname, tablename, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY tablename, indexname
  `

  const criticalUniqueIndexes = [
    { name: "users_email_idx", table: "users" },
    { name: "buildings_code_idx", table: "buildings" },
    { name: "reports_reference_number_idx", table: "reports" },
  ]

  for (const idx of criticalUniqueIndexes) {
    const found = indexResult.find((r) => r.indexname === idx.name && (r.indexdef as string).includes("UNIQUE"))
    check(`Unique index "${idx.name}" on ${idx.table}`, !!found)
  }

  const performanceIndexes = [
    "reports_student_id_idx", "reports_status_idx", "reports_priority_idx",
    "reports_building_id_idx", "reports_assigned_staff_idx", "reports_created_at_idx",
    "notifications_recipient_id_idx", "notifications_read_at_idx",
    "report_images_report_id_idx", "ai_analyses_report_id_idx",
    "report_status_history_report_id_idx", "report_assignments_report_id_idx",
    "audit_logs_created_at_idx", "sessions_user_id_idx",
  ]

  for (const idxName of performanceIndexes) {
    const found = indexResult.some((r) => r.indexname === idxName)
    check(`Index "${idxName}"`, found)
  }

  // ─── 5. Seed data ────────────────────────────────────────────────────────
  console.log("\n🔍 5. Verifying seed data...")
  const deptCount = await db.select().from(schema.departments)
  check(`Departments seeded (${deptCount.length})`, deptCount.length >= 6)

  const buildingCount = await db.select().from(schema.buildings)
  check(`Buildings seeded (${buildingCount.length})`, buildingCount.length >= 6)

  const catCount = await db.select().from(schema.facilityCategories)
  check(`Facility categories seeded (${catCount.length})`, catCount.length >= 11)

  const linkedCats = catCount.filter((c) => c.defaultDepartmentId !== null)
  check(`Categories linked to departments (${linkedCats.length}/${catCount.length})`, linkedCats.length >= 10)

  // ─── 6. Constraint enforcement ────────────────────────────────────────────
  console.log("\n🔍 6. Verifying constraint enforcement...")

  // Test invalid priority
  try {
    await sql`INSERT INTO reports (id, reference_number, student_id, title, description, building_id, priority, status)
      VALUES (gen_random_uuid(), 'TEST-INVALID', gen_random_uuid(), 'test', 'test', gen_random_uuid(), 'invalid_priority', 'submitted')`
    check("Invalid priority rejected", false, "insert succeeded unexpectedly")
  } catch {
    check("Invalid priority rejected", true)
  }

  // Test invalid status
  try {
    await sql`INSERT INTO reports (id, reference_number, student_id, title, description, building_id, priority, status)
      VALUES (gen_random_uuid(), 'TEST-INVALID2', gen_random_uuid(), 'test', 'test', gen_random_uuid(), 'medium', 'invalid_status')`
    check("Invalid status rejected", false, "insert succeeded unexpectedly")
  } catch {
    check("Invalid status rejected", true)
  }

  // Test duplicate email
  try {
    const testEmail = `verify-test-${Date.now()}@test.local`
    await sql`INSERT INTO users (id, name, email, role) VALUES (gen_random_uuid(), 'Test1', ${testEmail}, 'student')`
    await sql`INSERT INTO users (id, name, email, role) VALUES (gen_random_uuid(), 'Test2', ${testEmail}, 'student')`
    check("Duplicate email rejected", false, "insert succeeded unexpectedly")
  } catch {
    check("Duplicate email rejected", true)
  }

  // Clean up test users
  await sql`DELETE FROM users WHERE email LIKE 'verify-test-%@test.local'`

  // Test duplicate building code
  try {
    await sql`INSERT INTO buildings (id, name, code) VALUES (gen_random_uuid(), 'Test Building 1', 'DUPCODE')`
    await sql`INSERT INTO buildings (id, name, code) VALUES (gen_random_uuid(), 'Test Building 2', 'DUPCODE')`
    check("Duplicate building code rejected", false, "insert succeeded unexpectedly")
  } catch {
    check("Duplicate building code rejected", true)
  }

  // Clean up test buildings
  await sql`DELETE FROM buildings WHERE code = 'DUPCODE'`

  // ─── 7. Migration tracking ───────────────────────────────────────────────
  console.log("\n🔍 7. Verifying migration tracking...")
  const migrationResult = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at`
  check(`Migration journal recorded (${migrationResult.length} entries)`, migrationResult.length >= 1)

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50))
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  if (failed === 0) {
    console.log("🎉 All verification checks passed!")
  } else {
    console.log("⚠️  Some checks failed — review output above.")
  }
  console.log("═".repeat(50))

  process.exit(failed > 0 ? 1 : 0)
}

verify().catch((error) => {
  console.error("❌ Verification failed:", error)
  process.exit(1)
})
