import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  real,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import type { AdapterAccountType } from "next-auth/adapters"

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "admin",
  "maintenance_staff",
])

export const reportStatusEnum = pgEnum("report_status", [
  "submitted",
  "under_review",
  "approved",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
  "reopened",
])

export const priorityEnum = pgEnum("priority", ["low", "medium", "high"])

export const aiReviewStatusEnum = pgEnum("ai_review_status", [
  "pending",
  "accepted",
  "corrected",
  "rejected",
])

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "active",
  "completed",
  "reassigned",
  "cancelled",
])

export const notificationTypeEnum = pgEnum("notification_type", [
  "report_submitted",
  "report_reviewed",
  "report_assigned",
  "status_update",
  "report_resolved",
  "report_rejected",
  "system",
])

// ─── Auth.js Tables ──────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    password: text("password"), // hashed, nullable for OAuth users
    role: userRoleEnum("role").notNull().default("student"),
    studentNumber: text("student_number"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_student_number_idx").on(table.studentNumber),
  ]
)

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
)

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
)

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ]
)

// ─── Buildings ───────────────────────────────────────────────────────────────

export const buildings = pgTable(
  "buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("buildings_code_idx").on(table.code)]
)

// ─── Departments ─────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// ─── Facility Categories ─────────────────────────────────────────────────────

export const facilityCategories = pgTable(
  "facility_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    defaultDepartmentId: uuid("default_department_id").references(
      () => departments.id,
      { onDelete: "set null" }
    ),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("facility_categories_dept_idx").on(table.defaultDepartmentId)]
)

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceNumber: text("reference_number").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "restrict" }),
    room: text("room"),
    categoryId: uuid("category_id").references(() => facilityCategories.id, {
      onDelete: "set null",
    }),
    priority: priorityEnum("priority").notNull().default("medium"),
    status: reportStatusEnum("status").notNull().default("submitted"),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, {
      onDelete: "set null",
    }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    aiAnalysisStatus: text("ai_analysis_status").default("pending"),
    adminResponse: text("admin_response"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    closedAt: timestamp("closed_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("reports_reference_number_idx").on(table.referenceNumber),
    index("reports_student_id_idx").on(table.studentId),
    index("reports_building_id_idx").on(table.buildingId),
    index("reports_category_id_idx").on(table.categoryId),
    index("reports_status_idx").on(table.status),
    index("reports_priority_idx").on(table.priority),
    index("reports_assigned_staff_idx").on(table.assignedStaffId),
    index("reports_department_id_idx").on(table.departmentId),
    index("reports_created_at_idx").on(table.createdAt),
  ]
)

// ─── Report Images ───────────────────────────────────────────────────────────

export const reportImages = pgTable(
  "report_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    fileUrl: text("file_url"),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("report_images_report_id_idx").on(table.reportId)]
)

// ─── AI Analyses ─────────────────────────────────────────────────────────────

export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    aiProvider: text("ai_provider"),
    modelName: text("model_name"),
    problemSummary: text("problem_summary"),
    detectedObject: text("detected_object"),
    suggestedCategoryId: uuid("suggested_category_id").references(
      () => facilityCategories.id,
      { onDelete: "set null" }
    ),
    suggestedPriority: priorityEnum("suggested_priority"),
    recommendedDepartmentId: uuid("recommended_department_id").references(
      () => departments.id,
      { onDelete: "set null" }
    ),
    generatedDescription: text("generated_description"),
    confidence: real("confidence"),
    requiresHumanReview: boolean("requires_human_review")
      .notNull()
      .default(true),
    reviewStatus: aiReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_analyses_report_id_idx").on(table.reportId),
    index("ai_analyses_review_status_idx").on(table.reviewStatus),
  ]
)

// ─── Report Status History ───────────────────────────────────────────────────

export const reportStatusHistory = pgTable(
  "report_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    previousStatus: reportStatusEnum("previous_status"),
    newStatus: reportStatusEnum("new_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isPublic: boolean("is_public").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("report_status_history_report_id_idx").on(table.reportId),
    index("report_status_history_actor_id_idx").on(table.actorId),
  ]
)

// ─── Report Assignments ──────────────────────────────────────────────────────

export const reportAssignments = pgTable(
  "report_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    assignedStaffId: uuid("assigned_staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedById: uuid("assigned_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    status: assignmentStatusEnum("status").notNull().default("active"),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => [
    index("report_assignments_report_id_idx").on(table.reportId),
    index("report_assignments_staff_id_idx").on(table.assignedStaffId),
    index("report_assignments_status_idx").on(table.status),
  ]
)

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_recipient_id_idx").on(table.recipientId),
    index("notifications_report_id_idx").on(table.reportId),
    index("notifications_read_at_idx").on(table.readAt),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
)

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"), // JSON string of non-sensitive context
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_entity_type_idx").on(table.entityType),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
)

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  reports: many(reports, { relationName: "studentReports" }),
  assignedReports: many(reports, { relationName: "staffAssignedReports" }),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  reviewedAnalyses: many(aiAnalyses),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const buildingsRelations = relations(buildings, ({ many }) => ({
  reports: many(reports),
}))

export const departmentsRelations = relations(departments, ({ many }) => ({
  facilityCategories: many(facilityCategories),
  recommendedByAi: many(aiAnalyses),
}))

export const facilityCategoriesRelations = relations(
  facilityCategories,
  ({ one, many }) => ({
    defaultDepartment: one(departments, {
      fields: [facilityCategories.defaultDepartmentId],
      references: [departments.id],
    }),
    reports: many(reports),
    suggestedByAi: many(aiAnalyses),
  })
)

export const reportsRelations = relations(reports, ({ one, many }) => ({
  student: one(users, {
    fields: [reports.studentId],
    references: [users.id],
    relationName: "studentReports",
  }),
  building: one(buildings, {
    fields: [reports.buildingId],
    references: [buildings.id],
  }),
  category: one(facilityCategories, {
    fields: [reports.categoryId],
    references: [facilityCategories.id],
  }),
  assignedStaff: one(users, {
    fields: [reports.assignedStaffId],
    references: [users.id],
    relationName: "staffAssignedReports",
  }),
  department: one(departments, { fields: [reports.departmentId], references: [departments.id] }),
  images: many(reportImages),
  aiAnalyses: many(aiAnalyses),
  statusHistory: many(reportStatusHistory),
  assignments: many(reportAssignments),
  notifications: many(notifications),
}))

export const reportImagesRelations = relations(reportImages, ({ one }) => ({
  report: one(reports, {
    fields: [reportImages.reportId],
    references: [reports.id],
  }),
  uploader: one(users, {
    fields: [reportImages.uploadedBy],
    references: [users.id],
  }),
}))

export const aiAnalysesRelations = relations(aiAnalyses, ({ one }) => ({
  report: one(reports, {
    fields: [aiAnalyses.reportId],
    references: [reports.id],
  }),
  suggestedCategory: one(facilityCategories, {
    fields: [aiAnalyses.suggestedCategoryId],
    references: [facilityCategories.id],
  }),
  recommendedDepartment: one(departments, {
    fields: [aiAnalyses.recommendedDepartmentId],
    references: [departments.id],
  }),
  reviewer: one(users, {
    fields: [aiAnalyses.reviewedBy],
    references: [users.id],
  }),
}))

export const reportStatusHistoryRelations = relations(
  reportStatusHistory,
  ({ one }) => ({
    report: one(reports, {
      fields: [reportStatusHistory.reportId],
      references: [reports.id],
    }),
    actor: one(users, {
      fields: [reportStatusHistory.actorId],
      references: [users.id],
    }),
  })
)

export const reportAssignmentsRelations = relations(
  reportAssignments,
  ({ one }) => ({
    report: one(reports, {
      fields: [reportAssignments.reportId],
      references: [reports.id],
    }),
    assignedStaff: one(users, {
      fields: [reportAssignments.assignedStaffId],
      references: [users.id],
    }),
    assignedBy: one(users, {
      fields: [reportAssignments.assignedById],
      references: [users.id],
    }),
  })
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
  }),
  report: one(reports, {
    fields: [notifications.reportId],
    references: [reports.id],
  }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}))

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type VerificationToken = typeof verificationTokens.$inferSelect
export type NewVerificationToken = typeof verificationTokens.$inferInsert

export type Building = typeof buildings.$inferSelect
export type NewBuilding = typeof buildings.$inferInsert

export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert

export type FacilityCategory = typeof facilityCategories.$inferSelect
export type NewFacilityCategory = typeof facilityCategories.$inferInsert

export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert

export type ReportImage = typeof reportImages.$inferSelect
export type NewReportImage = typeof reportImages.$inferInsert

export type AiAnalysis = typeof aiAnalyses.$inferSelect
export type NewAiAnalysis = typeof aiAnalyses.$inferInsert

export type ReportStatusHistory = typeof reportStatusHistory.$inferSelect
export type NewReportStatusHistory = typeof reportStatusHistory.$inferInsert

export type ReportAssignment = typeof reportAssignments.$inferSelect
export type NewReportAssignment = typeof reportAssignments.$inferInsert

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number]
export type Priority = (typeof priorityEnum.enumValues)[number]
export type AiReviewStatus = (typeof aiReviewStatusEnum.enumValues)[number]
export type AssignmentStatus = (typeof assignmentStatusEnum.enumValues)[number]
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number]


