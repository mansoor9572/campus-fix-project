import { eq, sql } from "drizzle-orm"
import {
  db,
  reports,
  aiAnalyses,
  facilityCategories,
  departments,
  users,
} from "@/lib/db"
import type { AiTriageResult, AiAnalysisRecord, AiReviewStatus } from "./types"

/**
 * Persist or update an AI analysis for a given report
 */
export async function saveAiAnalysis(
  reportId: string,
  triage: AiTriageResult
): Promise<AiAnalysisRecord> {
  // Find category ID if not provided
  let categoryId = triage.suggestedCategoryId || null
  if (!categoryId && triage.suggestedCategory) {
    const [cat] = await db
      .select({ id: facilityCategories.id })
      .from(facilityCategories)
      .where(sql`lower(${facilityCategories.name}) = ${triage.suggestedCategory.toLowerCase()}`)
      .limit(1)
    categoryId = cat?.id || null
  }

  // Find department ID if not provided
  let departmentId = triage.recommendedDepartmentId || null
  if (!departmentId && triage.recommendedDepartment) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(sql`lower(${departments.name}) = ${triage.recommendedDepartment.toLowerCase()}`)
      .limit(1)
    departmentId = dept?.id || null
  }

  // Insert AI analysis
  const [created] = await db
    .insert(aiAnalyses)
    .values({
      reportId,
      aiProvider: triage.aiProvider,
      modelName: triage.modelName,
      problemSummary: triage.problemSummary,
      detectedObject: triage.detectedObject,
      suggestedCategoryId: categoryId,
      suggestedPriority: triage.suggestedPriority,
      recommendedDepartmentId: departmentId,
      generatedDescription: triage.generatedDescription,
      confidence: triage.confidence,
      requiresHumanReview: true,
      reviewStatus: "pending",
    })
    .returning()

  // Update report's AI analysis status to completed
  await db
    .update(reports)
    .set({
      aiAnalysisStatus: "completed",
      updatedAt: new Date(),
    })
    .where(eq(reports.id, reportId))

  return {
    id: created.id,
    reportId: created.reportId,
    problemSummary: created.problemSummary || triage.problemSummary,
    detectedObject: created.detectedObject || triage.detectedObject,
    suggestedCategory: triage.suggestedCategory,
    suggestedCategoryId: categoryId,
    suggestedPriority: (created.suggestedPriority as "low" | "medium" | "high") || triage.suggestedPriority,
    recommendedDepartment: triage.recommendedDepartment,
    recommendedDepartmentId: departmentId,
    generatedDescription: created.generatedDescription || triage.generatedDescription,
    confidence: created.confidence || triage.confidence,
    requiresHumanReview: created.requiresHumanReview,
    reviewStatus: created.reviewStatus as AiReviewStatus,
    reviewedBy: created.reviewedBy,
    reviewedAt: created.reviewedAt?.toISOString() || null,
    createdAt: created.createdAt.toISOString(),
    aiProvider: created.aiProvider || triage.aiProvider,
    modelName: created.modelName || triage.modelName,
  }
}

/**
 * Retrieve the AI analysis associated with a report
 */
export async function getAiAnalysis(reportIdOrRef: string): Promise<AiAnalysisRecord | null> {
  const isUuid =
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      reportIdOrRef
    )

  // Resolve reportId
  let targetReportId = reportIdOrRef
  if (!isUuid) {
    const [rep] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.referenceNumber, reportIdOrRef))
      .limit(1)
    if (!rep) return null
    targetReportId = rep.id
  }

  const [row] = await db
    .select({
      id: aiAnalyses.id,
      reportId: aiAnalyses.reportId,
      aiProvider: aiAnalyses.aiProvider,
      modelName: aiAnalyses.modelName,
      problemSummary: aiAnalyses.problemSummary,
      detectedObject: aiAnalyses.detectedObject,
      suggestedCategoryId: aiAnalyses.suggestedCategoryId,
      suggestedCategoryName: facilityCategories.name,
      suggestedPriority: aiAnalyses.suggestedPriority,
      recommendedDepartmentId: aiAnalyses.recommendedDepartmentId,
      recommendedDepartmentName: departments.name,
      generatedDescription: aiAnalyses.generatedDescription,
      confidence: aiAnalyses.confidence,
      requiresHumanReview: aiAnalyses.requiresHumanReview,
      reviewStatus: aiAnalyses.reviewStatus,
      reviewedBy: aiAnalyses.reviewedBy,
      reviewerName: users.name,
      reviewedAt: aiAnalyses.reviewedAt,
      createdAt: aiAnalyses.createdAt,
    })
    .from(aiAnalyses)
    .leftJoin(facilityCategories, eq(aiAnalyses.suggestedCategoryId, facilityCategories.id))
    .leftJoin(departments, eq(aiAnalyses.recommendedDepartmentId, departments.id))
    .leftJoin(users, eq(aiAnalyses.reviewedBy, users.id))
    .where(eq(aiAnalyses.reportId, targetReportId))
    .orderBy(sql`${aiAnalyses.createdAt} DESC`)
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    reportId: row.reportId,
    problemSummary: row.problemSummary || "",
    detectedObject: row.detectedObject || "",
    suggestedCategory: row.suggestedCategoryName || "Other",
    suggestedCategoryId: row.suggestedCategoryId,
    suggestedPriority: (row.suggestedPriority as "low" | "medium" | "high") || "medium",
    recommendedDepartment: row.recommendedDepartmentName || "Facilities Services",
    recommendedDepartmentId: row.recommendedDepartmentId,
    generatedDescription: row.generatedDescription || "",
    confidence: row.confidence || 0.85,
    requiresHumanReview: row.requiresHumanReview,
    reviewStatus: row.reviewStatus as AiReviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedByName: row.reviewerName,
    reviewedAt: row.reviewedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    aiProvider: row.aiProvider || "Google Gemini",
    modelName: row.modelName || "gemini-3.8-flash",
  }
}

/**
 * Update the review status of an AI analysis (accepted, rejected, corrected)
 */
export async function reviewAiAnalysis(
  reportIdOrRef: string,
  reviewerId: string,
  reviewStatus: AiReviewStatus
): Promise<AiAnalysisRecord> {
  const existing = await getAiAnalysis(reportIdOrRef)
  if (!existing) {
    throw new Error("No AI analysis found for this report.")
  }

  const [updated] = await db
    .update(aiAnalyses)
    .set({
      reviewStatus,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(aiAnalyses.id, existing.id))
    .returning()

  return {
    ...existing,
    reviewStatus: updated.reviewStatus as AiReviewStatus,
    reviewedBy: updated.reviewedBy,
    reviewedAt: updated.reviewedAt?.toISOString() || null,
  }
}
