import test from "node:test"
import assert from "node:assert/strict"
import { searchBuildings, UMY_BUILDINGS, type BuildingEntry } from "../lib/buildings/directory"
import { buildingInput } from "../lib/buildings/validation"
import { createInput, patchInput } from "../lib/reports/validation"
import { locationSummary, LOCATION_LIMITS } from "../lib/reports/location"

const entries: BuildingEntry[] = UMY_BUILDINGS.map((entry, index) => ({ id: String(index), code: null, faculty: null,
  description: null, mapsUrl: null, latitude: null, longitude: null, sourceUrl: null, verificationStatus: "unverified", isActive: true, ...entry }))

test("UMY directory includes all 27 supplied entries and distinct engineering codes", () => {
  assert.equal(entries.length, 27)
  assert.equal(new Set(UMY_BUILDINGS.map(entry => entry.directoryKey)).size, 27)
  for (const code of ["F1", "F3", "F4", "F6"]) {
    const found = searchBuildings(entries, code)
    assert.equal(found.length, 1)
    assert.equal(found[0].code, code)
    assert.equal(searchBuildings(entries, code.toLowerCase())[0].code, code)
  }
})

test("directory search supports English, Indonesian, faculties, aliases, partial names and empty results", () => {
  for (const [query, name] of [
    ["Engineering", "Engineering Building F6"], ["Fakultas Teknik", "Faculty of Engineering"],
    ["FISIPOL", "Faculty of Social and Political Sciences"], ["Fachruddin A", "A.R. Fachruddin A"],
    ["Ibrahim", "KH. Ibrahim Building"], ["Library", "UMY Library"], ["Perpustakaan", "UMY Library"],
    ["Sportorium", "Sportorium UMY"], ["Masjid", "KH. Ahmad Dahlan Mosque"],
    ["Dormitory", "UMY Student Dormitory"], ["Asrama", "UMY Student Dormitory"],
    ["fAKUltaS teKNik f6", "Engineering Building F6"], ["Fachrud", "A.R. Fachruddin B"],
  ]) assert.ok(searchBuildings(entries, query).some(entry => entry.name === name), query)
  assert.equal(searchBuildings(entries, "no-such-building-9999").length, 0)
  assert.equal(searchBuildings(entries, "").length, entries.length)
})

test("building management validates verification sources, coordinates, links and field limits", () => {
  const base = { name: "Engineering F6", code: "F6", aliases: ["Teknik", "Teknik"] }
  assert.deepEqual(buildingInput(base).aliases, ["Teknik"])
  assert.equal(buildingInput(base).verificationStatus, "unverified")
  assert.equal(buildingInput({ name: "Building with no known code" }).code, null)
  for (const invalid of [{ name: "" }, { name: "a".repeat(161) }, { verificationStatus: "official" },
    { verificationStatus: "verified" }, { latitude: 12, longitude: 20 },
    { verificationStatus: "verified", sourceUrl: "https://umy.ac.id", latitude: 91, longitude: 0 },
    { mapsUrl: "javascript:alert(1)" }, { mapsUrl: "https://evil.example" }, { aliases: [1] },
    { isActive: "true" }, { role: "admin" }]) assert.throws(() => buildingInput({ ...base, ...invalid }))
})

const report = { title: "Leaking air conditioner", description: "Water is leaking near the entrance to the laboratory.",
  buildingId: "11111111-1111-4111-8111-111111111111", categoryId: "22222222-2222-4222-8222-222222222222",
  floor: "  Ground Floor  ", roomNumber: "  Laboratory 3  " }

test("new reports require manually entered floor and room with independent limits", () => {
  const result = createInput(report)
  assert.equal(result.floor, "Ground Floor")
  assert.equal(result.roomNumber, "Laboratory 3")
  assert.equal(result.additionalDetails, "")
  for (const field of ["floor", "roomNumber"] as const) {
    for (const value of [undefined, "", "   ", 2, "x".repeat(LOCATION_LIMITS[field] + 1), "test\0"])
      assert.throws(() => createInput({ ...report, [field]: value }))
    assert.equal(createInput({ ...report, [field]: "1" })[field], "1")
  }
  assert.throws(() => createInput({ ...report, additionalDetails: "x".repeat(501) }))
  assert.throws(() => createInput({ ...report, additionalDetails: 1 }))
  assert.equal(createInput({ ...report, additionalDetails: " near elevator " }).additionalDetails, "near elevator")
})

test("legacy location text remains readable without fabricated floor or room", () => {
  assert.equal(locationSummary({ room: "east stairwell, 2nd floor" }), "east stairwell, 2nd floor")
  assert.equal(locationSummary({}), "Location details not recorded")
  assert.equal(locationSummary({ room: "old", floor: "Basement", roomNumber: "B1", additionalDetails: "Near lift" }), "Basement · B1 · Near lift")
  assert.deepEqual(patchInput({ version: "2026-11-07T00:00:00Z", status: "under_review" }), { version: "2026-11-07T00:00:00Z", status: "under_review" })
  assert.throws(() => patchInput({ version: "2026-11-07T00:00:00Z", floor: "" }))
  assert.throws(() => patchInput({ version: "2026-11-07T00:00:00Z", room: "legacy", roomNumber: "new" }))
})
