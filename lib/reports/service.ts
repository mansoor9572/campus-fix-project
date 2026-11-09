import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm"
import {
  db,
  reports,
  reportStatusHistory,
  reportAssignments,
  notifications,
  auditLogs,
  buildings,
  departments,
  facilityCategories,
  users,
  reportImages,
  aiAnalyses,
  type UserRole,
} from "@/lib/db"
import { locationSummary } from "./location"
import type { ReportUpdate } from "@/lib/campus-fix/data"
import { triageFacilityIssue } from "@/lib/ai/gemini"
import { saveAiAnalysis, getAiAnalysis } from "@/lib/ai/service"
import { canAccessReport, priorityLabels, statusLabels, transitions } from "./policy"
import {
  createInput,
  listInput,
  noteInput,
  patchInput,
  ReportError,
} from "./validation"

// ─── Reference Number Generation ─────────────────────────────────────────────

async function nextReferenceNumber(): Promise<string> {
  // Query the highest existing numeric suffix of RPT-XXXX
  const result = await db.execute(sql<{ max_ref: number | null }>`
    SELECT COALESCE(
      MAX(
        CASE 
          WHEN reference_number ~ '^RPT-[0-9]+$' 
          THEN substring(reference_number FROM 5)::integer 
          ELSE NULL 
        END
      ), 
      1040
    ) AS max_ref
    FROM reports
  `)
  const maxRef = Number(result.rows[0]?.max_ref ?? 1040)
  return `RPT-${maxRef + 1}`
}

// ─── Create Report ───────────────────────────────────────────────────────────

export async function createReport(
  actor: { id: string; role: UserRole; name?: string | null },
  rawInput: unknown
) {
  if (actor.role !== "student" && actor.role !== "admin") {
    throw new ReportError("Only students or administrators can submit reports.", 403)
  }

  const input = createInput(rawInput)

  // Verify building exists and is active
  const [building] = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(and(eq(buildings.id, input.buildingId), eq(buildings.isActive, true)))
    .limit(1)

  if (!building) throw new ReportError("Specified building not found or inactive.", 404)

  // Verify category exists and is active
  const [category] = await db
    .select({
      id: facilityCategories.id,
      name: facilityCategories.name,
      defaultDepartmentId: facilityCategories.defaultDepartmentId,
    })
    .from(facilityCategories)
    .where(
      and(
        eq(facilityCategories.id, input.categoryId),
        eq(facilityCategories.isActive, true)
      )
    )
    .limit(1)

  if (!category) throw new ReportError("Specified category not found or inactive.", 404)

  // Auto-route to category's default department if available
  const departmentId = category.defaultDepartmentId ?? null

  // Insert new report
  const refNumber = await nextReferenceNumber()

  const [newReport] = await db
    .insert(reports)
    .values({
      referenceNumber: refNumber,
      studentId: actor.id,
      title: input.title,
      description: input.description,
      buildingId: input.buildingId,
      room: input.roomNumber,
      floor: input.floor,
      roomNumber: input.roomNumber,
      additionalDetails: input.additionalDetails || null,
      categoryId: input.categoryId,
      departmentId,
      priority: input.priority,
      status: "submitted",
    })
    .returning()

  // Initial status history entry
  await db.insert(reportStatusHistory).values({
    reportId: newReport.id,
    previousStatus: null,
    newStatus: "submitted",
    actorId: actor.id,
    isPublic: true,
    note: "Report received by Campus Operations.",
  })

  // Confirmation notification to student
  await db.insert(notifications).values({
    recipientId: actor.id,
    reportId: newReport.id,
    title: "Your report was submitted",
    message: `${refNumber} is now in the Campus Operations review queue.`,
    type: "report_submitted",
  })

  // Store uploaded images (linked from /api/uploads)
  if (input.images && input.images.length > 0) {
    for (const img of input.images) {
      await db.insert(reportImages).values({
        reportId: newReport.id,
        storageKey: img.storageKey,
        fileUrl: img.fileUrl,
        originalFilename: img.originalFilename,
        mimeType: img.mimeType,
        fileSize: img.fileSize,
        uploadedBy: actor.id,
      })
    }
  }

  // Audit log entry
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "report.created",
    entityType: "report",
    entityId: newReport.id,
    metadata: JSON.stringify({
      referenceNumber: refNumber,
      priority: input.priority,
      buildingId: input.buildingId,
      categoryId: input.categoryId,
      imageCount: input.images?.length ?? 0,
    }),
  })

  // Automatic AI triage & analysis (includes uploaded photo if present)
  try {
    let triageImage: { base64: string; mimeType: string } | undefined
    if (input.images && input.images.length > 0) {
      const firstImg = input.images[0]
      if (firstImg.fileUrl.startsWith("data:")) {
        triageImage = {
          base64: firstImg.fileUrl,
          mimeType: firstImg.mimeType || "image/jpeg",
        }
      } else {
        try {
          const diskPath = join(process.cwd(), "public", "uploads", firstImg.storageKey)
          const fileBuf = await readFile(diskPath)
          triageImage = {
            base64: `data:${firstImg.mimeType || "image/jpeg"};base64,${fileBuf.toString("base64")}`,
            mimeType: firstImg.mimeType || "image/jpeg",
          }
        } catch {
          // Continue without image if reading from disk fails
        }
      }
    }

    const triage = await triageFacilityIssue({
      title: input.title,
      description: input.description,
      building: building.name,
      room: locationSummary(input),
      image: triageImage,
    })
    await saveAiAnalysis(newReport.id, triage)
  } catch (err) {
    console.error("Auto AI triage error:", err)
  }

  return getReportById(actor, newReport.id)
}

// ─── List Reports ────────────────────────────────────────────────────────────

export async function listReports(
  actor: { id: string; role: UserRole },
  searchParams: URLSearchParams
) {
  const params = listInput(searchParams)
  const conditions = []

  // Role scoping: students only see their own, staff only see assigned
  if (actor.role === "student") {
    conditions.push(eq(reports.studentId, actor.id))
  } else if (actor.role === "maintenance_staff") {
    conditions.push(eq(reports.assignedStaffId, actor.id))
  }

  // Filters
  if (params.status) {
    conditions.push(eq(reports.status, params.status))
  }

  if (params.priority) {
    conditions.push(eq(reports.priority, params.priority))
  }

  if (params.buildingId) {
    conditions.push(eq(reports.buildingId, params.buildingId))
  }

  if (params.categoryId) {
    conditions.push(eq(reports.categoryId, params.categoryId))
  }

  if (params.days && params.days !== "all") {
    const cutoffDate = new Date(Date.now() - Number(params.days) * 24 * 60 * 60 * 1000)
    conditions.push(gte(reports.createdAt, cutoffDate))
  }

  if (params.q) {
    const pattern = `%${params.q}%`
    conditions.push(
      or(
        ilike(reports.referenceNumber, pattern),
        ilike(reports.title, pattern),
        ilike(reports.description, pattern),
        ilike(reports.room, pattern),
        ilike(reports.floor, pattern),
        ilike(reports.roomNumber, pattern),
        ilike(reports.additionalDetails, pattern),
        ilike(users.name, pattern)
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Total count
  const [{ totalCount }] = await db
    .select({ totalCount: sql<number>`count(*)::int` })
    .from(reports)
    .leftJoin(users, eq(reports.studentId, users.id))
    .where(whereClause)

  // Order criteria
  const orderClauses =
    params.sort === "priority"
      ? [
          sql`CASE ${reports.priority} 
                WHEN 'high' THEN 1 
                WHEN 'medium' THEN 2 
                WHEN 'low' THEN 3 
                ELSE 4 
              END`,
          desc(reports.createdAt),
        ]
      : [desc(reports.createdAt)]

  const offset = (params.page - 1) * params.pageSize

  const rows = await db
    .select({
      id: reports.id,
      referenceNumber: reports.referenceNumber,
      title: reports.title,
      description: reports.description,
      room: reports.room,
      floor: reports.floor,
      roomNumber: reports.roomNumber,
      additionalDetails: reports.additionalDetails,
      priority: reports.priority,
      status: reports.status,
      createdAt: reports.createdAt,
      updatedAt: reports.updatedAt,
      resolvedAt: reports.resolvedAt,
      closedAt: reports.closedAt,
      buildingId: reports.buildingId,
      buildingName: buildings.name,
      buildingCode: buildings.code,
      categoryId: reports.categoryId,
      categoryName: facilityCategories.name,
      departmentId: reports.departmentId,
      departmentName: departments.name,
      studentId: reports.studentId,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterProgram: users.studentNumber,
      assignedStaffId: reports.assignedStaffId,
    })
    .from(reports)
    .leftJoin(buildings, eq(reports.buildingId, buildings.id))
    .leftJoin(facilityCategories, eq(reports.categoryId, facilityCategories.id))
    .leftJoin(departments, eq(reports.departmentId, departments.id))
    .leftJoin(users, eq(reports.studentId, users.id))
    .where(whereClause)
    .orderBy(...orderClauses)
    .limit(params.pageSize)
    .offset(offset)

  // Fetch assigned staff names for rows with assignedStaffId
  const staffIds = [
    ...new Set(rows.map((r) => r.assignedStaffId).filter((id): id is string => Boolean(id))),
  ]
  const staffMap: Record<string, string> = {}
  if (staffIds.length > 0) {
    const staffRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, staffIds))
    for (const s of staffRows) {
      staffMap[s.id] = s.name
    }
  }

  // Fetch AI analysis for each report
  const reportDbIds = rows.map((r) => r.id)
  const aiMap: Record<string, {
    problemSummary: string
    detectedObject: string
    suggestedCategory: string
    suggestedPriority: string
    recommendedDepartment: string
    generatedDescription: string
    confidence: number
    requiresHumanReview: boolean
    reviewStatus: string
    aiProvider: string
    modelName: string
  }> = {}

  if (reportDbIds.length > 0) {
    const aiRows = await db
      .select({
        reportId: aiAnalyses.reportId,
        problemSummary: aiAnalyses.problemSummary,
        detectedObject: aiAnalyses.detectedObject,
        suggestedPriority: aiAnalyses.suggestedPriority,
        generatedDescription: aiAnalyses.generatedDescription,
        confidence: aiAnalyses.confidence,
        requiresHumanReview: aiAnalyses.requiresHumanReview,
        reviewStatus: aiAnalyses.reviewStatus,
        aiProvider: aiAnalyses.aiProvider,
        modelName: aiAnalyses.modelName,
        suggestedCategoryName: facilityCategories.name,
        recommendedDepartmentName: departments.name,
      })
      .from(aiAnalyses)
      .leftJoin(facilityCategories, eq(aiAnalyses.suggestedCategoryId, facilityCategories.id))
      .leftJoin(departments, eq(aiAnalyses.recommendedDepartmentId, departments.id))
      .where(inArray(aiAnalyses.reportId, reportDbIds))

    for (const a of aiRows) {
      aiMap[a.reportId] = {
        problemSummary: a.problemSummary || "",
        detectedObject: a.detectedObject || "",
        suggestedCategory: a.suggestedCategoryName || "Other",
        suggestedPriority: a.suggestedPriority || "medium",
        recommendedDepartment: a.recommendedDepartmentName || "Facilities Services",
        generatedDescription: a.generatedDescription || "",
        confidence: a.confidence || 0.85,
        requiresHumanReview: a.requiresHumanReview,
        reviewStatus: a.reviewStatus,
        aiProvider: a.aiProvider || "Google Gemini",
        modelName: a.modelName || "gemini-2.5-flash",
      }
    }
  }

  // Fetch images for each report
  const imageMap: Record<string, string[]> = {}
  if (reportDbIds.length > 0) {
    const imageRows = await db
      .select({
        reportId: reportImages.reportId,
        fileUrl: reportImages.fileUrl,
        storageKey: reportImages.storageKey,
      })
      .from(reportImages)
      .where(inArray(reportImages.reportId, reportDbIds))
      .orderBy(reportImages.createdAt)

    for (const img of imageRows) {
      const url = img.fileUrl || img.storageKey
      if (!imageMap[img.reportId]) imageMap[img.reportId] = []
      imageMap[img.reportId].push(url)
    }
  }

  // List consumers render activity and timelines too. Keep the same history
  // visibility as the detail endpoint, fetching once for the current page.
  const updateMap: Record<string, ReportUpdate[]> = {}
  if (reportDbIds.length > 0) {
    const historyConditions = [inArray(reportStatusHistory.reportId, reportDbIds)]
    if (actor.role === "student") historyConditions.push(eq(reportStatusHistory.isPublic, true))
    const historyRows = await db
      .select({
        id: reportStatusHistory.id,
        reportId: reportStatusHistory.reportId,
        previousStatus: reportStatusHistory.previousStatus,
        newStatus: reportStatusHistory.newStatus,
        actorName: users.name,
        note: reportStatusHistory.note,
        createdAt: reportStatusHistory.createdAt,
      })
      .from(reportStatusHistory)
      .leftJoin(users, eq(reportStatusHistory.actorId, users.id))
      .where(and(...historyConditions))
      .orderBy(desc(reportStatusHistory.createdAt))

    for (const h of historyRows) {
      (updateMap[h.reportId] ??= []).push({
        id: h.id,
        createdAt: h.createdAt.toISOString(),
        actor: h.actorName ?? "Campus Operations",
        title: h.previousStatus ? `Status changed to ${statusLabels[h.newStatus]}` : "Report submitted",
        message: h.note || `Status updated to ${statusLabels[h.newStatus]}.`,
      })
    }
  }

  const items = rows.map((r) => ({
    id: r.referenceNumber, // UI uses referenceNumber as id (e.g., RPT-1048)
    dbId: r.id,
    title: r.title,
    description: r.description,
    category: r.categoryName ?? "Other",
    building: r.buildingName ?? "Unknown Building",
    room: r.room ?? "",
    buildingId: r.buildingId,
    floor: r.floor,
    roomNumber: r.roomNumber,
    additionalDetails: r.additionalDetails,
    status: statusLabels[r.status],
    priority: priorityLabels[r.priority],
    reporterName: r.reporterName ?? "Campus User",
    reporterEmail: r.reporterEmail ?? "",
    reporterProgram: r.reporterProgram ?? "Student",
    assignedTo: r.assignedStaffId ? staffMap[r.assignedStaffId] ?? null : null,
    department: r.departmentName ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    images: imageMap[r.id] ?? [],
    updates: updateMap[r.id] ?? [],
    aiAnalysis: aiMap[r.id] ?? null,
  }))

  return {
    reports: items,
    total: totalCount,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(totalCount / params.pageSize),
  }
}

// ─── Get Report By ID or Reference ───────────────────────────────────────────

export async function getReportById(
  actor: { id: string; role: UserRole },
  idOrRef: string
) {
  const isUuid =
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      idOrRef
    )

  const [row] = await db
    .select({
      id: reports.id,
      referenceNumber: reports.referenceNumber,
      title: reports.title,
      description: reports.description,
      room: reports.room,
      floor: reports.floor,
      roomNumber: reports.roomNumber,
      additionalDetails: reports.additionalDetails,
      priority: reports.priority,
      status: reports.status,
      createdAt: reports.createdAt,
      updatedAt: reports.updatedAt,
      resolvedAt: reports.resolvedAt,
      closedAt: reports.closedAt,
      adminResponse: reports.adminResponse,
      buildingId: reports.buildingId,
      buildingName: buildings.name,
      buildingCode: buildings.code,
      categoryId: reports.categoryId,
      categoryName: facilityCategories.name,
      departmentId: reports.departmentId,
      departmentName: departments.name,
      studentId: reports.studentId,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterProgram: users.studentNumber,
      assignedStaffId: reports.assignedStaffId,
    })
    .from(reports)
    .leftJoin(buildings, eq(reports.buildingId, buildings.id))
    .leftJoin(facilityCategories, eq(reports.categoryId, facilityCategories.id))
    .leftJoin(departments, eq(reports.departmentId, departments.id))
    .leftJoin(users, eq(reports.studentId, users.id))
    .where(isUuid ? eq(reports.id, idOrRef) : eq(reports.referenceNumber, idOrRef))
    .limit(1)

  if (!row) throw new ReportError("Report not found.", 404)

  if (
    !canAccessReport(actor, {
      studentId: row.studentId,
      assignedStaffId: row.assignedStaffId,
    })
  ) {
    throw new ReportError("Access denied.", 403)
  }

  // Assigned staff name
  let assignedStaffName: string | null = null
  if (row.assignedStaffId) {
    const [staffUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, row.assignedStaffId))
      .limit(1)
    assignedStaffName = staffUser?.name ?? null
  }

  // Status history query
  const historyConditions = [eq(reportStatusHistory.reportId, row.id)]
  if (actor.role === "student") {
    historyConditions.push(eq(reportStatusHistory.isPublic, true))
  }

  const historyRows = await db
    .select({
      id: reportStatusHistory.id,
      previousStatus: reportStatusHistory.previousStatus,
      newStatus: reportStatusHistory.newStatus,
      actorId: reportStatusHistory.actorId,
      actorName: users.name,
      isPublic: reportStatusHistory.isPublic,
      note: reportStatusHistory.note,
      createdAt: reportStatusHistory.createdAt,
    })
    .from(reportStatusHistory)
    .leftJoin(users, eq(reportStatusHistory.actorId, users.id))
    .where(and(...historyConditions))
    .orderBy(desc(reportStatusHistory.createdAt))

  // Images query
  const images = await db
    .select({
      id: reportImages.id,
      fileUrl: reportImages.fileUrl,
      storageKey: reportImages.storageKey,
      originalFilename: reportImages.originalFilename,
    })
    .from(reportImages)
    .where(eq(reportImages.reportId, row.id))
    .orderBy(reportImages.createdAt)

  // Assignments query
  const assignments = await db
    .select({
      id: reportAssignments.id,
      assignedStaffId: reportAssignments.assignedStaffId,
      assignedStaffName: users.name,
      status: reportAssignments.status,
      assignedAt: reportAssignments.assignedAt,
      completedAt: reportAssignments.completedAt,
    })
    .from(reportAssignments)
    .leftJoin(users, eq(reportAssignments.assignedStaffId, users.id))
    .where(eq(reportAssignments.reportId, row.id))
    .orderBy(desc(reportAssignments.assignedAt))

  const updates = historyRows.map((h) => ({
    id: h.id,
    createdAt: h.createdAt.toISOString(),
    actor: h.actorName ?? "Campus Operations",
    title: h.previousStatus
      ? `Status changed to ${statusLabels[h.newStatus]}`
      : "Report submitted",
    message: h.note || `Status updated to ${statusLabels[h.newStatus]}.`,
  }))

  const aiRecord = await getAiAnalysis(row.id)

  return {
    id: row.referenceNumber,
    dbId: row.id,
    title: row.title,
    description: row.description,
    category: row.categoryName ?? "Other",
    categoryId: row.categoryId,
    building: row.buildingName ?? "Unknown Building",
    buildingId: row.buildingId,
    room: row.room ?? "",
    floor: row.floor,
    roomNumber: row.roomNumber,
    additionalDetails: row.additionalDetails,
    status: statusLabels[row.status],
    priority: priorityLabels[row.priority],
    reporterName: row.reporterName ?? "Campus User",
    reporterEmail: row.reporterEmail ?? "",
    reporterProgram: row.reporterProgram ?? "Student",
    assignedTo: assignedStaffName,
    assignedStaffId: row.assignedStaffId,
    department: row.departmentName ?? null,
    departmentId: row.departmentId,
    adminResponse: row.adminResponse,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    images: images.map((img) => img.fileUrl || img.storageKey),
    updates,
    assignments,
    aiAnalysis: aiRecord ? {
      id: aiRecord.id,
      problemSummary: aiRecord.problemSummary,
      detectedObject: aiRecord.detectedObject,
      suggestedCategory: aiRecord.suggestedCategory,
      suggestedPriority: aiRecord.suggestedPriority,
      recommendedDepartment: aiRecord.recommendedDepartment,
      generatedDescription: aiRecord.generatedDescription,
      confidence: aiRecord.confidence,
      requiresHumanReview: aiRecord.requiresHumanReview,
      reviewStatus: aiRecord.reviewStatus,
      aiProvider: aiRecord.aiProvider,
      modelName: aiRecord.modelName,
    } : null,
  }
}

// ─── Update Report ───────────────────────────────────────────────────────────

export async function updateReport(
  actor: { id: string; role: UserRole; name?: string | null },
  reportIdOrRef: string,
  rawPatch: unknown
) {
  const patch = patchInput(rawPatch)

  const isUuid =
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      reportIdOrRef
    )

  const [current] = await db
    .select()
    .from(reports)
    .where(isUuid ? eq(reports.id, reportIdOrRef) : eq(reports.referenceNumber, reportIdOrRef))
    .limit(1)

  if (!current) throw new ReportError("Report not found.", 404)

  if (
    !canAccessReport(actor, {
      studentId: current.studentId,
      assignedStaffId: current.assignedStaffId,
    })
  ) {
    throw new ReportError("Access denied.", 403)
  }

  // Concurrency check (tolerates ISO millisecond formatting differences)
  const currentVersionTime = new Date(current.updatedAt).getTime()
  const patchVersionTime = new Date(patch.version).getTime()
  if (isNaN(patchVersionTime) || Math.abs(currentVersionTime - patchVersionTime) > 1000) {
    throw new ReportError(
      "This report was updated by another user. Please reload and try again.",
      409
    )
  }

  // Role permissions enforcement
  if (actor.role === "student") {
    if (patch.priority !== undefined) throw new ReportError("Students cannot modify priority.", 403)
    if (patch.categoryId !== undefined) throw new ReportError("Students cannot modify category.", 403)
    if (patch.buildingId !== undefined) throw new ReportError("Students cannot modify building.", 403)
    if (patch.departmentId !== undefined) throw new ReportError("Students cannot assign departments.", 403)
    if (patch.assignedStaffId !== undefined) throw new ReportError("Students cannot assign staff.", 403)
    if (patch.status && !transitions("student", current.status).includes(patch.status)) {
      throw new ReportError(`Cannot transition from ${current.status} to ${patch.status}.`, 400)
    }
  }

  if (actor.role === "maintenance_staff") {
    if (patch.priority !== undefined) throw new ReportError("Staff cannot modify priority.", 403)
    if (patch.categoryId !== undefined) throw new ReportError("Staff cannot modify category.", 403)
    if (patch.buildingId !== undefined) throw new ReportError("Staff cannot modify building.", 403)
    if (patch.departmentId !== undefined) throw new ReportError("Staff cannot reassign departments.", 403)
    if (patch.assignedStaffId !== undefined) throw new ReportError("Staff cannot reassign staff.", 403)
    if (patch.status && !transitions("maintenance_staff", current.status).includes(patch.status)) {
      throw new ReportError(`Cannot transition from ${current.status} to ${patch.status}.`, 400)
    }
  }

  if (actor.role === "admin") {
    if (patch.status && patch.status !== current.status) {
      if (!transitions("admin", current.status).includes(patch.status)) {
        throw new ReportError(`Cannot transition from ${current.status} to ${patch.status}.`, 400)
      }
    }
  }

  // Execute changes
  const updateValues: Partial<typeof reports.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (patch.title !== undefined) updateValues.title = patch.title
  if (patch.description !== undefined) updateValues.description = patch.description
  if (patch.room !== undefined) {
    if (current.roomNumber || current.floor) throw new ReportError("Use the separate floor and room number fields.");
    updateValues.room = patch.room
  }
  if (patch.floor !== undefined) updateValues.floor = patch.floor
  if (patch.roomNumber !== undefined) { updateValues.roomNumber = patch.roomNumber; updateValues.room = patch.roomNumber }
  if (patch.additionalDetails !== undefined) updateValues.additionalDetails = patch.additionalDetails || null
  if (patch.buildingId !== undefined) updateValues.buildingId = patch.buildingId
  if (patch.categoryId !== undefined) updateValues.categoryId = patch.categoryId
  if (patch.priority !== undefined) updateValues.priority = patch.priority
  if (patch.departmentId !== undefined) updateValues.departmentId = patch.departmentId

  let newStatus = current.status

  // Status transition
  if (patch.status && patch.status !== current.status) {
    newStatus = patch.status
    updateValues.status = newStatus

    if (newStatus === "resolved") {
      updateValues.resolvedAt = new Date()
    } else if (newStatus === "closed") {
      updateValues.closedAt = new Date()
    }

    await db.insert(reportStatusHistory).values({
      reportId: current.id,
      previousStatus: current.status,
      newStatus,
      actorId: actor.id,
      isPublic: true,
      note: patch.note || `Status changed to ${statusLabels[newStatus]}.`,
    })

    // Notify student
    await db.insert(notifications).values({
      recipientId: current.studentId,
      reportId: current.id,
      title: `Report ${current.referenceNumber} updated`,
      message: `Status is now ${statusLabels[newStatus]}.`,
      type: newStatus === "resolved" ? "report_resolved" : "status_update",
    })
  } else if (patch.note) {
    // Note without status change
    await db.insert(reportStatusHistory).values({
      reportId: current.id,
      previousStatus: current.status,
      newStatus: current.status,
      actorId: actor.id,
      isPublic: actor.role === "student" ? true : true,
      note: patch.note,
    })
  }

  // Staff assignment (admin only)
  if (patch.assignedStaffId !== undefined && patch.assignedStaffId !== current.assignedStaffId) {
    if (patch.assignedStaffId !== null) {
      // Verify technician exists, is active and has maintenance_staff role
      const [staff] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          and(
            eq(users.id, patch.assignedStaffId),
            eq(users.role, "maintenance_staff"),
            eq(users.isActive, true)
          )
        )
        .limit(1)

      if (!staff) throw new ReportError("Selected maintenance staff member not found or inactive.", 404)

      // Close any active assignment
      await db
        .update(reportAssignments)
        .set({ status: "reassigned", completedAt: new Date() })
        .where(and(eq(reportAssignments.reportId, current.id), eq(reportAssignments.status, "active")))

      // Create new active assignment
      await db.insert(reportAssignments).values({
        reportId: current.id,
        assignedStaffId: patch.assignedStaffId,
        assignedById: actor.id,
        status: "active",
      })

      updateValues.assignedStaffId = patch.assignedStaffId

      // Auto-move status to "assigned" or "under_review" if currently submitted
      if (current.status === "submitted" && !patch.status) {
        updateValues.status = "assigned"
        newStatus = "assigned"

        await db.insert(reportStatusHistory).values({
          reportId: current.id,
          previousStatus: "submitted",
          newStatus: "assigned",
          actorId: actor.id,
          isPublic: true,
          note: `Assigned to technician ${staff.name}.`,
        })
      }

      // Notify technician
      await db.insert(notifications).values({
        recipientId: patch.assignedStaffId,
        reportId: current.id,
        title: "New work order assigned",
        message: `You were assigned report ${current.referenceNumber}.`,
        type: "report_assigned",
      })

      // Notify student
      await db.insert(notifications).values({
        recipientId: current.studentId,
        reportId: current.id,
        title: "Technician assigned",
        message: `A technician (${staff.name}) was assigned to ${current.referenceNumber}.`,
        type: "report_assigned",
      })
    } else {
      // Staff assignment removed
      await db
        .update(reportAssignments)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(and(eq(reportAssignments.reportId, current.id), eq(reportAssignments.status, "active")))

      updateValues.assignedStaffId = null

      await db.insert(reportStatusHistory).values({
        reportId: current.id,
        previousStatus: current.status,
        newStatus: current.status,
        actorId: actor.id,
        isPublic: true,
        note: "Technician assignment removed.",
      })
    }
  }

  // Apply report row updates
  await db.update(reports).set(updateValues).where(eq(reports.id, current.id))

  // Audit log
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "report.updated",
    entityType: "report",
    entityId: current.id,
    metadata: JSON.stringify({
      status: newStatus,
      assignedStaffId: updateValues.assignedStaffId ?? current.assignedStaffId,
      priority: updateValues.priority ?? current.priority,
    }),
  })

  return getReportById(actor, current.id)
}

// ─── Add Note to Report ──────────────────────────────────────────────────────

export async function addReportNote(
  actor: { id: string; role: UserRole; name?: string | null },
  reportIdOrRef: string,
  rawInput: unknown
) {
  const input = noteInput(rawInput)

  const isUuid =
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      reportIdOrRef
    )

  const [report] = await db
    .select({
      id: reports.id,
      studentId: reports.studentId,
      assignedStaffId: reports.assignedStaffId,
      status: reports.status,
      updatedAt: reports.updatedAt,
      referenceNumber: reports.referenceNumber,
    })
    .from(reports)
    .where(isUuid ? eq(reports.id, reportIdOrRef) : eq(reports.referenceNumber, reportIdOrRef))
    .limit(1)

  if (!report) throw new ReportError("Report not found.", 404)

  if (
    !canAccessReport(actor, {
      studentId: report.studentId,
      assignedStaffId: report.assignedStaffId,
    })
  ) {
    throw new ReportError("Access denied.", 403)
  }

  await db.insert(reportStatusHistory).values({
    reportId: report.id,
    previousStatus: report.status,
    newStatus: report.status,
    actorId: actor.id,
    isPublic: actor.role === "student" ? true : input.isPublic,
    note: input.message,
  })

  await db
    .update(reports)
    .set({ updatedAt: new Date() })
    .where(eq(reports.id, report.id))

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "report.note_added",
    entityType: "report",
    entityId: report.id,
    metadata: JSON.stringify({ isPublic: input.isPublic }),
  })

  return { message: "Note added successfully." }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getDashboardStats(
  actor: { id: string; role: UserRole },
  days = "all"
) {
  const conditions = []

  if (actor.role === "student") {
    conditions.push(eq(reports.studentId, actor.id))
  } else if (actor.role === "maintenance_staff") {
    conditions.push(eq(reports.assignedStaffId, actor.id))
  }

  if (days !== "all") {
    const cutoffDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    conditions.push(gte(reports.createdAt, cutoffDate))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Total reports & status breakdowns
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${reports.status} IN ('submitted', 'under_review'))::int`,
      inProgress: sql<number>`count(*) FILTER (WHERE ${reports.status} = 'in_progress')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${reports.status} = 'resolved')::int`,
      urgent: sql<number>`count(*) FILTER (WHERE ${reports.priority} = 'high' AND ${reports.status} NOT IN ('resolved', 'closed', 'rejected'))::int`,
    })
    .from(reports)
    .where(whereClause)

  // Average resolution hours for resolved reports
  const [resolutionAvg] = await db
    .select({
      avgHours: sql<number | null>`ROUND(AVG(EXTRACT(EPOCH FROM (${reports.resolvedAt} - ${reports.createdAt})) / 3600)::numeric, 1)::float`,
    })
    .from(reports)
    .where(
      whereClause
        ? and(whereClause, sql`${reports.resolvedAt} IS NOT NULL`)
        : sql`${reports.resolvedAt} IS NOT NULL`
    )

  // Distribution by category
  const categoryStats = await db
    .select({
      category: facilityCategories.name,
      count: sql<number>`count(*)::int`,
    })
    .from(reports)
    .innerJoin(facilityCategories, eq(reports.categoryId, facilityCategories.id))
    .where(whereClause)
    .groupBy(facilityCategories.name)
    .orderBy(desc(sql`count(*)`))

  // Distribution by building
  const buildingStats = await db
    .select({
      building: buildings.name,
      count: sql<number>`count(*)::int`,
    })
    .from(reports)
    .innerJoin(buildings, eq(reports.buildingId, buildings.id))
    .where(whereClause)
    .groupBy(buildings.name)
    .orderBy(desc(sql`count(*)`))

  // Distribution by priority
  const priorityStats = await db
    .select({
      priority: reports.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(reports)
    .where(whereClause)
    .groupBy(reports.priority)

  // Workload (for admin role)
  let workload: Array<{ name: string; staffId: string; openCount: number }> = []
  if (actor.role === "admin") {
    // Fetch all active maintenance staff members
    const allStaff = await db
      .select({
        staffId: users.id,
        staffName: users.name,
      })
      .from(users)
      .where(and(eq(users.role, "maintenance_staff"), eq(users.isActive, true)))

    const workloadRows = await db
      .select({
        staffId: reports.assignedStaffId,
        openCount: sql<number>`count(*)::int`,
      })
      .from(reports)
      .where(
        and(
          sql`${reports.assignedStaffId} IS NOT NULL`,
          sql`${reports.status} NOT IN ('resolved', 'closed', 'rejected')`
        )
      )
      .groupBy(reports.assignedStaffId)

    const staffCounts: Record<string, number> = {}
    for (const row of workloadRows) {
      if (row.staffId) staffCounts[row.staffId] = row.openCount
    }

    workload = allStaff.map((s) => ({
      staffId: s.staffId,
      name: s.staffName,
      openCount: staffCounts[s.staffId] || 0,
    }))
  }

  const total = counts?.total ?? 0
  const resolved = counts?.resolved ?? 0
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0
  const avgResolutionHours = resolutionAvg?.avgHours ?? null

  return {
    total,
    pending: counts?.pending ?? 0,
    inProgress: counts?.inProgress ?? 0,
    resolved,
    urgent: counts?.urgent ?? 0,
    resolutionRate,
    avgResolutionHours,
    byCategory: categoryStats.map((c) => ({ category: c.category, count: c.count })),
    byBuilding: buildingStats.map((b) => ({ building: b.building, count: b.count })),
    byPriority: priorityStats.map((p) => ({
      priority: priorityLabels[p.priority],
      count: p.count,
    })),
    workload,
  }
}

// ─── Reference Data (Buildings, Categories, Departments, Staff) ───────────────

export async function getReferenceData() {
  const [buildingRows, categoryRows, departmentRows, staffRows] = await Promise.all([
    db
      .select({
        id: buildings.id,
        name: buildings.name,
        code: buildings.code,
        description: buildings.description,
      })
      .from(buildings)
      .where(eq(buildings.isActive, true))
      .orderBy(buildings.name),

    db
      .select({
        id: facilityCategories.id,
        name: facilityCategories.name,
        description: facilityCategories.description,
        defaultDepartmentId: facilityCategories.defaultDepartmentId,
        defaultDepartmentName: departments.name,
      })
      .from(facilityCategories)
      .leftJoin(departments, eq(facilityCategories.defaultDepartmentId, departments.id))
      .where(eq(facilityCategories.isActive, true))
      .orderBy(facilityCategories.name),

    db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description,
      })
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(departments.name),

    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "maintenance_staff"),
          eq(users.isActive, true),
          sql`${users.emailVerified} IS NOT NULL`
        )
      )
      .orderBy(users.name),
  ])

  return {
    buildings: buildingRows,
    categories: categoryRows,
    departments: departmentRows,
    staff: staffRows,
  }
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function listNotifications(actor: { id: string }) {
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      reportId: notifications.reportId,
      reportRef: reports.referenceNumber,
    })
    .from(notifications)
    .leftJoin(reports, eq(notifications.reportId, reports.id))
    .where(eq(notifications.recipientId, actor.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    read: Boolean(r.readAt),
    reportId: r.reportRef ?? r.reportId ?? undefined,
    type: r.type === "report_submitted" || r.type === "report_assigned" || r.type === "status_update" || r.type === "report_resolved"
      ? ("status" as const)
      : ("system" as const),
  }))
}

export async function markNotificationRead(actor: { id: string }, notificationId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, actor.id)))
    .returning({ id: notifications.id })

  if (!updated) throw new ReportError("Notification not found.", 404)
  return { success: true }
}

export async function markAllNotificationsRead(actor: { id: string }) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, actor.id), sql`${notifications.readAt} IS NULL`))

  return { success: true }
}
