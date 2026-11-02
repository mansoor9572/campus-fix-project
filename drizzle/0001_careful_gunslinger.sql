ALTER TABLE "reports" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_department_id_idx" ON "reports" USING btree ("department_id");