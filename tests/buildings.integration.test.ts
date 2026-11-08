import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db, buildings } from "../lib/db"
import { listBuildings, saveBuilding } from "../lib/buildings/service"

test("directory management rejects students and staff; inactive buildings stay in admin directory", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  assert.ok(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "Run through scripts/test-reports.ts against the test branch.")
  for (const role of ["student", "maintenance_staff"] as const) await assert.rejects(() => saveBuilding({ role }, { name: "Forbidden" }), /Only administrators/)
  const created = await saveBuilding({ role: "admin" }, { name: `Directory integration ${randomUUID()}`, aliases: ["Integration alias"], isActive: true })
  try {
    assert.ok((await listBuildings()).some(row => row.id === created.id))
    const updated = await saveBuilding({ role: "admin" }, { name: created.name, aliases: created.aliases, isActive: false }, created.id)
    assert.equal(updated.id, created.id)
    assert.ok(!(await listBuildings()).some(row => row.id === created.id))
    assert.ok((await listBuildings(true)).some(row => row.id === created.id))
  } finally { await db.delete(buildings).where(eq(buildings.id, created.id)) }
})
