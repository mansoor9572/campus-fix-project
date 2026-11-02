import test from "node:test"
import assert from "node:assert/strict"
import { canAccessReport, isTerminal, priorityLabels, statusLabels, transitions } from "../lib/reports/policy"
import {
  createInput,
  listInput,
  noteInput,
  patchInput,
  ReportError,
} from "../lib/reports/validation"

const validUuid = "11111111-1111-4111-8111-111111111111"
const validUuid2 = "22222222-2222-4222-8222-222222222222"

test("report creation validation: valid inputs and defaults", () => {
  const raw = {
    title: "Air conditioning leaking water",
    description: "Water is dripping from the AC unit onto the lecture hall floor.",
    buildingId: validUuid,
    categoryId: validUuid2,
    room: "Room 101",
    priority: "High",
  }
  const result = createInput(raw)
  assert.equal(result.title, "Air conditioning leaking water")
  assert.equal(result.priority, "high")
  assert.equal(result.buildingId, validUuid)
  assert.equal(result.categoryId, validUuid2)
  assert.equal(result.room, "Room 101")

  // Default priority is medium if omitted
  const noPriority = createInput({ ...raw, priority: undefined })
  assert.equal(noPriority.priority, "medium")
})

test("report creation validation: rejects invalid or dangerous input", () => {
  const base = {
    title: "Valid title",
    description: "Valid description over twenty characters.",
    buildingId: validUuid,
    categoryId: validUuid2,
    room: "101",
  }

  // Short title (< 8 chars)
  assert.throws(() => createInput({ ...base, title: "Short" }), ReportError)

  // Long title (> 120 chars)
  assert.throws(() => createInput({ ...base, title: "A".repeat(121) }), ReportError)

  // Short description (< 20 chars)
  assert.throws(() => createInput({ ...base, description: "Too short" }), ReportError)

  // Invalid UUID
  assert.throws(() => createInput({ ...base, buildingId: "not-a-uuid" }), ReportError)

  // Unsupported fields / prototype pollution attempts
  assert.throws(() => createInput({ ...base, status: "resolved" }), ReportError)
  assert.throws(() => createInput({ ...base, isAdmin: true }), ReportError)

  // Null byte injection
  assert.throws(() => createInput({ ...base, title: "Title with \u0000 null byte" }), ReportError)
})

test("report patch validation: optimistic locking version and field updates", () => {
  const validVersion = "2026-10-29T16:30:45.000Z"

  // Status and priority update
  const patch = patchInput({
    version: validVersion,
    status: "In Progress",
    priority: "Low",
    note: "Work has begun on this request.",
  })
  assert.equal(patch.version, validVersion)
  assert.equal(patch.status, "in_progress")
  assert.equal(patch.priority, "low")
  assert.equal(patch.note, "Work has begun on this request.")

  // Missing version fails
  assert.throws(() => patchInput({ status: "resolved" }), ReportError)

  // No change provided (only version) fails
  assert.throws(() => patchInput({ version: validVersion }), ReportError)

  // Disallowed fields fail
  assert.throws(
    () => patchInput({ version: validVersion, studentId: validUuid }),
    ReportError
  )
})

test("report note validation: length and visibility", () => {
  const validVersion = "2026-10-29T16:30:45.000Z"
  const note = noteInput({
    message: "Technician checked the filter and ordered replacement parts.",
    isPublic: true,
    version: validVersion,
  })
  assert.equal(note.isPublic, true)
  assert.equal(note.version, validVersion)

  // Too short note (< 4 chars)
  assert.throws(
    () => noteInput({ message: "No", version: validVersion }),
    ReportError
  )
})

test("report list query validation: pagination and filters", () => {
  const params = new URLSearchParams({
    page: "2",
    pageSize: "25",
    q: "library air",
    status: "submitted",
    priority: "high",
    days: "7",
    sort: "priority",
  })
  const parsed = listInput(params)
  assert.equal(parsed.page, 2)
  assert.equal(parsed.pageSize, 25)
  assert.equal(parsed.q, "library air")
  assert.equal(parsed.status, "submitted")
  assert.equal(parsed.priority, "high")
  assert.equal(parsed.days, "7")
  assert.equal(parsed.sort, "priority")

  // Disallowed parameter fails
  const badParams = new URLSearchParams({ malicious: "drop table" })
  assert.throws(() => listInput(badParams), ReportError)
})

test("role-based status transitions: student permissions", () => {
  // Students can only close or reopen a resolved report, or reopen a closed report
  assert.deepEqual(transitions("student", "resolved"), ["closed", "reopened"])
  assert.deepEqual(transitions("student", "closed"), ["reopened"])

  // Students cannot transition submitted, under_review, in_progress, etc.
  assert.deepEqual(transitions("student", "submitted"), [])
  assert.deepEqual(transitions("student", "under_review"), [])
  assert.deepEqual(transitions("student", "in_progress"), [])
})

test("role-based status transitions: maintenance staff permissions", () => {
  // Maintenance staff can start work and resolve assigned tasks
  assert.deepEqual(transitions("maintenance_staff", "assigned"), ["in_progress"])
  assert.deepEqual(transitions("maintenance_staff", "in_progress"), ["resolved"])
  assert.deepEqual(transitions("maintenance_staff", "reopened"), ["in_progress"])

  // Staff cannot approve, reject, or close reports
  assert.equal(transitions("maintenance_staff", "submitted").includes("rejected"), false)
  assert.equal(transitions("maintenance_staff", "resolved").includes("closed"), false)
})

test("role-based status transitions: administrator full lifecycle", () => {
  // Admin can transition submitted reports to review, approved, assigned, in_progress, rejected
  const fromSubmitted = transitions("admin", "submitted")
  assert.ok(fromSubmitted.includes("under_review"))
  assert.ok(fromSubmitted.includes("approved"))
  assert.ok(fromSubmitted.includes("rejected"))

  // Admin can reopen closed or rejected reports
  assert.ok(transitions("admin", "closed").includes("reopened"))
  assert.ok(transitions("admin", "rejected").includes("reopened"))
})

test("report ownership and assignment access control", () => {
  const studentUser = { id: validUuid, role: "student" as const }
  const otherStudent = { id: "33333333-3333-4333-8333-333333333333", role: "student" as const }
  const staffUser = { id: validUuid2, role: "maintenance_staff" as const }
  const otherStaff = { id: "44444444-4444-4444-8444-444444444444", role: "maintenance_staff" as const }
  const adminUser = { id: "55555555-5555-4555-8555-555555555555", role: "admin" as const }

  const report = { studentId: validUuid, assignedStaffId: validUuid2 }

  // Student owner can access
  assert.equal(canAccessReport(studentUser, report), true)

  // Other student CANNOT access
  assert.equal(canAccessReport(otherStudent, report), false)

  // Assigned technician can access
  assert.equal(canAccessReport(staffUser, report), true)

  // Other technician CANNOT access
  assert.equal(canAccessReport(otherStaff, report), false)

  // Administrator can access any report
  assert.equal(canAccessReport(adminUser, report), true)
})

test("terminal status check and label mappings", () => {
  assert.equal(isTerminal("resolved"), true)
  assert.equal(isTerminal("closed"), true)
  assert.equal(isTerminal("rejected"), true)
  assert.equal(isTerminal("submitted"), false)
  assert.equal(isTerminal("in_progress"), false)

  assert.equal(statusLabels["in_progress"], "In Progress")
  assert.equal(priorityLabels["high"], "High")
})

