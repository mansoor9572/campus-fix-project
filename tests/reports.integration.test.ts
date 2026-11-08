import test from "node:test"
import assert from "node:assert/strict"
import { config } from "dotenv"
config({ path: ".env.local" })

import { db, users, reports, reportStatusHistory, reportAssignments, notifications, auditLogs, buildings, facilityCategories } from "../lib/db"
import { createReport, getReportById, listReports, updateReport, addReportNote, getDashboardStats } from "../lib/reports/service"
import { ReportError } from "../lib/reports/validation"
import { eq, inArray } from "drizzle-orm"

const testSuffix = Math.random().toString(36).substring(2, 9)

test("full report lifecycle and authorization integration test", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  assert.ok(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "Run through scripts/test-reports.ts against the test branch.")
  // 1. Setup temporary test users
  const studentEmail = `report-test-student-${testSuffix}@campus.test`
  const student2Email = `report-test-student2-${testSuffix}@campus.test`
  const staffEmail = `report-test-staff-${testSuffix}@campus.test`
  const adminEmail = `report-test-admin-${testSuffix}@campus.test`

  const [student] = await db.insert(users).values({
    name: `Test Student ${testSuffix}`,
    email: studentEmail,
    role: "student",
    studentNumber: "CS-2027",
    emailVerified: new Date(),
  }).returning()

  const [student2] = await db.insert(users).values({
    name: `Test Student 2 ${testSuffix}`,
    email: student2Email,
    role: "student",
    studentNumber: "BIO-2026",
    emailVerified: new Date(),
  }).returning()

  const [staff] = await db.insert(users).values({
    name: `Test Tech ${testSuffix}`,
    email: staffEmail,
    role: "maintenance_staff",
    emailVerified: new Date(),
  }).returning()

  const [admin] = await db.insert(users).values({
    name: `Test Admin ${testSuffix}`,
    email: adminEmail,
    role: "admin",
    emailVerified: new Date(),
  }).returning()

  // Get active building and category from seeded reference data
  const [building] = await db.select().from(buildings).where(eq(buildings.isActive, true)).limit(1)
  const [category] = await db.select().from(facilityCategories).where(eq(facilityCategories.isActive, true)).limit(1)

  assert.ok(building, "Seed building must exist")
  assert.ok(category, "Seed category must exist")

  let createdReportId = ""
  let createdDbId = ""

  try {
    // 2. Student creates a report
    const created = await createReport(student, {
      title: "Broken window latch in study hall",
      description: "The window latch on the third floor is broken and rattling in the wind.",
      buildingId: building.id,
      categoryId: category.id,
      floor: "2nd Floor",
      roomNumber: "Room 304",
      additionalDetails: "Near the elevator",
      priority: "High",
    })

    createdReportId = created.id
    createdDbId = created.dbId

    assert.ok(created.id.startsWith("RPT-"), "Reference number starts with RPT-")
    assert.equal(created.status, "Submitted")
    assert.equal(created.priority, "High")
    assert.equal(created.building, building.name)
    assert.equal(created.buildingId, building.id)
    assert.equal(created.floor, "2nd Floor")
    assert.equal(created.roomNumber, "Room 304")
    assert.equal(created.additionalDetails, "Near the elevator")
    const [stored] = await db.select().from(reports).where(eq(reports.id, created.dbId))
    assert.equal(stored.floor, created.floor)
    assert.equal(stored.roomNumber, created.roomNumber)
    assert.equal(stored.additionalDetails, created.additionalDetails)
    assert.equal(created.category, category.name)
    assert.equal(created.updates.length, 1)

    // 3. Test listing and scoping
    // Student 1 sees 1 report
    const student1List = await listReports(student, new URLSearchParams())
    assert.ok(student1List.reports.some(r => r.id === createdReportId))

    // Student 2 sees 0 reports
    const student2List = await listReports(student2, new URLSearchParams())
    assert.ok(!student2List.reports.some(r => r.id === createdReportId))

    // Staff sees 0 reports (not assigned yet)
    const staffList = await listReports(staff, new URLSearchParams())
    assert.ok(!staffList.reports.some(r => r.id === createdReportId))

    // Admin sees the report
    const adminList = await listReports(admin, new URLSearchParams())
    assert.ok(adminList.reports.some(r => r.id === createdReportId))

    // 4. Test detail retrieval permissions
    // Student 1 can view
    const viewOwn = await getReportById(student, createdReportId)
    assert.equal(viewOwn.id, createdReportId)

    // Student 2 CANNOT view (403 Access Denied)
    await assert.rejects(
      async () => getReportById(student2, createdReportId),
      (err: unknown) => err instanceof ReportError && err.status === 403
    )

    // 5. Admin review and staff assignment
    const assignedReport = await updateReport(admin, createdReportId, {
      version: viewOwn.version,
      assignedStaffId: staff.id,
      note: "Assigned to on-duty technician for inspection.",
    })

    assert.equal(assignedReport.status, "Assigned")
    assert.equal(assignedReport.assignedTo, staff.name)

    // Verify staff can now access the report
    const staffView = await getReportById(staff, createdReportId)
    assert.equal(staffView.id, createdReportId)

    // 6. Technician starts work and resolves
    const inProgressReport = await updateReport(staff, createdReportId, {
      version: staffView.version,
      status: "In Progress",
      note: "Arrived on site; inspecting latch mechanism.",
    })
    assert.equal(inProgressReport.status, "In Progress")

    const resolvedReport = await updateReport(staff, createdReportId, {
      version: inProgressReport.version,
      status: "Resolved",
      note: "Window latch replaced and tested securely.",
    })
    assert.equal(resolvedReport.status, "Resolved")
    assert.ok(resolvedReport.resolvedAt)

    // 7. Student follow-up note
    await addReportNote(student, createdReportId, {
      message: "Checked the window, works great now!",
      isPublic: true,
      version: resolvedReport.version,
    })

    // Fetch updated version after note
    const freshView = await getReportById(student, createdReportId)

    // 8. Authorization boundary enforcement
    // Student cannot assign staff
    await assert.rejects(
      async () => updateReport(student, createdReportId, {
        version: freshView.version,
        assignedStaffId: staff.id,
      }),
      (err: unknown) => err instanceof ReportError && err.status === 403
    )

    // Student cannot change priority
    await assert.rejects(
      async () => updateReport(student, createdReportId, {
        version: freshView.version,
        priority: "Low",
      }),
      (err: unknown) => err instanceof ReportError && err.status === 403
    )

    // Concurrency conflict test (wrong version)
    await assert.rejects(
      async () => updateReport(admin, createdReportId, {
        version: "2020-01-01T00:00:00.000Z",
        status: "in_progress",
      }),
      (err: unknown) => err instanceof ReportError && err.status === 409
    )

    // 9. Dashboard stats verification
    const adminStats = await getDashboardStats(admin)
    assert.ok(adminStats.total >= 1)
    assert.ok(adminStats.resolved >= 1)

  } finally {
    // 10. Clean up only the records created by this test
    if (createdDbId) {
      await db.delete(notifications).where(eq(notifications.reportId, createdDbId))
      await db.delete(reportAssignments).where(eq(reportAssignments.reportId, createdDbId))
      await db.delete(reportStatusHistory).where(eq(reportStatusHistory.reportId, createdDbId))
      await db.delete(auditLogs).where(eq(auditLogs.entityId, createdDbId))
      await db.delete(reports).where(eq(reports.id, createdDbId))
    }

    const testUserIds = [student.id, student2.id, staff.id, admin.id]
    await db.delete(notifications).where(inArray(notifications.recipientId, testUserIds))
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, testUserIds))
    await db.delete(users).where(inArray(users.id, testUserIds))
  }
})

