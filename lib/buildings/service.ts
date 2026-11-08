import { eq } from "drizzle-orm"
import { db, buildings, type UserRole } from "@/lib/db"
import { ReportError, uuid } from "@/lib/reports/validation"
import { buildingInput } from "./validation"

export async function listBuildings(includeInactive = false) {
  return db.select().from(buildings).where(includeInactive ? undefined : eq(buildings.isActive, true)).orderBy(buildings.name)
}

export async function saveBuilding(actor: { role: UserRole }, raw: unknown, id?: string) {
  if (actor.role !== "admin") throw new ReportError("Only administrators can manage buildings.", 403)
  const values = buildingInput(raw)
  const rows = id
    ? await db.update(buildings).set({ ...values, updatedAt: new Date() }).where(eq(buildings.id, uuid(id))).returning()
    : await db.insert(buildings).values(values).returning()
  if (!rows[0]) throw new ReportError("Building not found.", 404)
  return rows[0]
}
