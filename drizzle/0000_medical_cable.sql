CREATE TYPE "public"."ai_review_status" AS ENUM('pending', 'accepted', 'corrected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed', 'reassigned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('report_submitted', 'report_reviewed', 'report_assigned', 'status_update', 'report_resolved', 'report_rejected', 'system');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('submitted', 'under_review', 'approved', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'admin', 'maintenance_staff');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"ai_provider" text,
	"model_name" text,
	"problem_summary" text,
	"detected_object" text,
	"suggested_category_id" uuid,
	"suggested_priority" "priority",
	"recommended_department_id" uuid,
	"generated_description" text,
	"confidence" real,
	"requires_human_review" boolean DEFAULT true NOT NULL,
	"review_status" "ai_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"report_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"assigned_staff_id" uuid NOT NULL,
	"assigned_by_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "report_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_url" text,
	"original_filename" text,
	"mime_type" text,
	"file_size" integer,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"previous_status" "report_status",
	"new_status" "report_status" NOT NULL,
	"actor_id" uuid,
	"is_public" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" text NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"building_id" uuid NOT NULL,
	"room" text,
	"category_id" uuid,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "report_status" DEFAULT 'submitted' NOT NULL,
	"assigned_staff_id" uuid,
	"ai_analysis_status" text DEFAULT 'pending',
	"admin_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"student_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_suggested_category_id_facility_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."facility_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_recommended_department_id_departments_id_fk" FOREIGN KEY ("recommended_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_categories" ADD CONSTRAINT "facility_categories_default_department_id_departments_id_fk" FOREIGN KEY ("default_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_category_id_facility_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."facility_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_report_id_idx" ON "ai_analyses" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "ai_analyses_review_status_idx" ON "ai_analyses" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_code_idx" ON "buildings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "facility_categories_dept_idx" ON "facility_categories" USING btree ("default_department_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_id_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_report_id_idx" ON "notifications" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_assignments_report_id_idx" ON "report_assignments" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_assignments_staff_id_idx" ON "report_assignments" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "report_assignments_status_idx" ON "report_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_images_report_id_idx" ON "report_images" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_status_history_report_id_idx" ON "report_status_history" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_status_history_actor_id_idx" ON "report_status_history" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reference_number_idx" ON "reports" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "reports_student_id_idx" ON "reports" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reports_building_id_idx" ON "reports" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "reports_category_id_idx" ON "reports" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_priority_idx" ON "reports" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "reports_assigned_staff_idx" ON "reports" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_student_number_idx" ON "users" USING btree ("student_number");