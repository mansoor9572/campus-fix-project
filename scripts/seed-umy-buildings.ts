import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { normalizeBuildingSearch, UMY_BUILDINGS } from "../lib/buildings/directory"

config({ path: ".env.local", quiet: true })

async function main() {
  const apply = process.argv.includes("--apply")
  const { db, buildings } = await import("../lib/db")
  const existing = await db.select().from(buildings)
  for (const entry of UMY_BUILDINGS) {
    const names = new Set([entry.name, entry.indonesianName, ...entry.aliases].filter(Boolean).map(name => normalizeBuildingSearch(name!)))
    // Generic aliases (Engineering, Dormitory, etc.) are search terms, not unique identities.
    const identities = new Set([entry.name, entry.indonesianName].filter(Boolean).map(name => normalizeBuildingSearch(name!)))
    const matches = existing.filter(row => row.directoryKey === entry.directoryKey ||
      (entry.code && row.code?.toLowerCase() === entry.code.toLowerCase()) ||
      identities.has(normalizeBuildingSearch(row.name)) ||
      (row.indonesianName && identities.has(normalizeBuildingSearch(row.indonesianName))) ||
      (names.has(normalizeBuildingSearch(row.name)) && !UMY_BUILDINGS.some(other => other !== entry && [other.name, other.indonesianName, ...other.aliases].filter(Boolean).some(name => normalizeBuildingSearch(name!) === normalizeBuildingSearch(row.name)))))
    if (matches.length > 1) throw new Error(`Ambiguous existing matches for ${entry.name}. Review before seeding.`)
    const current = matches[0]
    if (current?.directoryKey && current.directoryKey !== entry.directoryKey) throw new Error(`Conflicting directory identity for ${entry.name}.`)
    if (current?.directoryKey === entry.directoryKey) { console.log(`Unchanged: ${entry.name}`); continue }
    console.log(`${apply ? "Applying" : "Preview"}: ${current ? "enrich" : "add"} ${entry.name}`)
    if (!apply) continue
    if (current) {
      // Preserve IDs, activation, verification, official names, maps and existing metadata.
      const [updated] = await db.update(buildings).set({
        directoryKey: entry.directoryKey,
        indonesianName: current.indonesianName || entry.indonesianName,
        code: current.code || entry.code || null,
        aliases: [...new Set([...current.aliases, ...entry.aliases])],
        faculty: current.faculty || entry.faculty || null,
        buildingType: current.buildingType || entry.buildingType,
        description: current.description || entry.description || "Initial UMY directory entry; location details await facilities confirmation.",
      }).where(eq(buildings.id, current.id)).returning()
      Object.assign(current, updated)
    } else {
      const [inserted] = await db.insert(buildings).values({ ...entry, verificationStatus: "unverified", description: entry.description || "Initial UMY directory entry; location details await facilities confirmation." }).returning()
      existing.push(inserted)
    }
  }
  console.log(apply ? "UMY directory seed complete." : "Preview only. Run with --apply after reviewing the target database.")
}
main().catch(() => { console.error("UMY seed stopped. Check migration status, duplicate names/codes, and database access. No existing reports were deleted."); process.exitCode = 1 })
