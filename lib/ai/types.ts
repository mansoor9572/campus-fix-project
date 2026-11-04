export type AiReviewStatus = "pending" | "accepted" | "corrected" | "rejected"

export type AiTriageResult = {
  problemSummary: string
  detectedObject: string
  suggestedCategory: string
  suggestedCategoryId?: string | null
  suggestedPriority: "low" | "medium" | "high"
  recommendedDepartment: string
  recommendedDepartmentId?: string | null
  generatedDescription: string
  confidence: number
  requiresHumanReview: boolean
  aiProvider: string
  modelName: string
}

export type AiAnalysisRecord = AiTriageResult & {
  id: string
  reportId: string
  reviewStatus: AiReviewStatus
  reviewedBy?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
  createdAt: string
}
