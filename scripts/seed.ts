import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import * as schema from "../lib/db/schema"

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.")
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })

  console.log("🌱 Seeding database...\n")

  // ─── Departments ─────────────────────────────────────────────────────────
  console.log("📁 Seeding departments...")
  const departmentData = [
    {
      name: "Facilities Services",
      description:
        "General campus facility maintenance including HVAC, furniture, and building systems.",
    },
    {
      name: "Electrical Services",
      description:
        "Electrical systems maintenance, lighting, and power infrastructure.",
    },
    {
      name: "Plumbing Services",
      description: "Plumbing systems, water fixtures, and drainage maintenance.",
    },
    {
      name: "Campus IT",
      description:
        "Information technology support, network infrastructure, and AV equipment.",
    },
    {
      name: "Campus Safety",
      description:
        "Safety-related facility issues, emergency systems, and structural safety.",
    },
    {
      name: "Housekeeping",
      description: "Cleaning services and general housekeeping maintenance.",
    },
  ]

  const departmentMap: Record<string, string> = {}

  for (const dept of departmentData) {
    // Upsert: check if exists by name, insert if not
    const existing = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.name, dept.name))
      .limit(1)

    if (existing.length > 0) {
      departmentMap[dept.name] = existing[0].id
      console.log(`  ✓ Department "${dept.name}" already exists`)
    } else {
      const [inserted] = await db
        .insert(schema.departments)
        .values(dept)
        .returning({ id: schema.departments.id })
      departmentMap[dept.name] = inserted.id
      console.log(`  + Department "${dept.name}" created`)
    }
  }

  // ─── Buildings ───────────────────────────────────────────────────────────
  console.log("\n🏢 Seeding buildings...")
  const buildingData = [
    {
      name: "North Science Center",
      code: "NSC",
      description: "Science laboratories, lecture halls, and research offices.",
    },
    {
      name: "Morrow Library",
      code: "MRL",
      description:
        "Main campus library with study areas, computer labs, and archives.",
    },
    {
      name: "Student Union",
      code: "SUN",
      description:
        "Student services center, dining areas, and event spaces.",
    },
    {
      name: "West Residence Hall",
      code: "WRH",
      description: "Student residential building with common areas.",
    },
    {
      name: "Fine Arts Building",
      code: "FAB",
      description:
        "Art studios, performance spaces, and the campus auditorium.",
    },
    {
      name: "Athletics Complex",
      code: "ATC",
      description:
        "Gymnasium, fitness center, pool, and outdoor sports facilities.",
    },
  ]

  for (const building of buildingData) {
    const existing = await db
      .select()
      .from(schema.buildings)
      .where(eq(schema.buildings.code, building.code))
      .limit(1)

    if (existing.length > 0) {
      console.log(
        `  ✓ Building "${building.name}" (${building.code}) already exists`
      )
    } else {
      await db.insert(schema.buildings).values(building)
      console.log(
        `  + Building "${building.name}" (${building.code}) created`
      )
    }
  }

  // ─── Facility Categories ─────────────────────────────────────────────────
  console.log("\n🏷️  Seeding facility categories...")
  const categoryData = [
    {
      name: "HVAC",
      description:
        "Heating, ventilation, and air conditioning systems.",
      defaultDept: "Facilities Services",
    },
    {
      name: "Electrical",
      description: "Electrical systems, outlets, wiring, and power issues.",
      defaultDept: "Electrical Services",
    },
    {
      name: "Plumbing",
      description: "Water fixtures, pipes, drainage, and sanitation systems.",
      defaultDept: "Plumbing Services",
    },
    {
      name: "IT & AV",
      description:
        "Network connectivity, projectors, computers, and AV equipment.",
      defaultDept: "Campus IT",
    },
    {
      name: "Furniture",
      description:
        "Desks, chairs, tables, and other campus furnishings.",
      defaultDept: "Facilities Services",
    },
    {
      name: "Safety",
      description:
        "Handrails, fire equipment, emergency systems, and structural hazards.",
      defaultDept: "Campus Safety",
    },
    {
      name: "Cleaning",
      description: "Cleaning needs, spills, and general hygiene issues.",
      defaultDept: "Housekeeping",
    },
    {
      name: "Lighting",
      description: "Indoor and outdoor lighting fixtures and controls.",
      defaultDept: "Electrical Services",
    },
    {
      name: "Doors & Windows",
      description:
        "Door locks, hinges, window mechanisms, and access issues.",
      defaultDept: "Facilities Services",
    },
    {
      name: "Wi-Fi & Network",
      description:
        "Wireless network coverage, connectivity, and network hardware.",
      defaultDept: "Campus IT",
    },
    {
      name: "Other",
      description:
        "Issues that do not fit into a predefined category.",
      defaultDept: "Facilities Services",
    },
  ]

  for (const cat of categoryData) {
    const existing = await db
      .select()
      .from(schema.facilityCategories)
      .where(eq(schema.facilityCategories.name, cat.name))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  ✓ Category "${cat.name}" already exists`)
    } else {
      await db.insert(schema.facilityCategories).values({
        name: cat.name,
        description: cat.description,
        defaultDepartmentId: departmentMap[cat.defaultDept] || null,
      })
      console.log(`  + Category "${cat.name}" created`)
    }
  }

  console.log("\n✅ Seed completed successfully!")
  console.log(
    "\nNote: No user accounts were seeded. Use the application's"
  )
  console.log(
    "registration flow or a separate bootstrap script to create admin users."
  )
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error)
  process.exit(1)
})

