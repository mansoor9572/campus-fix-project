# Phase 3 report backend

## Demo-to-backend mapping

| Existing UI | Backend operation |
| --- | --- |
| Student submission | Create report and initial public status history atomically |
| Student/admin lists, search and filters | Role-scoped, server-filtered and paginated report query |
| Report/task details | Ownership/assignment-scoped report, history and assignment reads |
| Dashboard counts/charts/workload | Server aggregates over the authorized dataset |
| Review, approval/rejection, priorities/categories | Validated report update with status history and audit |
| Department/staff assignment, reassignment | Atomic report update, assignment lifecycle, history and notification |
| Maintenance start/resolve | Assigned-staff-only state transitions |
| Student follow-up / team/work notes | Persist history entries, with public/internal visibility |
| Student close/reopen | Owner-only transitions from resolved/closed |
| Bulk admin actions | Await individually authorized operations and report partial failures |
| CSV export | Export the current authorized page; neutralize spreadsheet formulas |
| Notifications/read state | Recipient-scoped database notifications |
| Upload/completion photos | Local preview only; never included in persisted requests |
| AI triage/suggestions | Unavailable; no generated result or confidence is claimed |
| Profile/preferences | Existing local demonstrations, outside report scope |

## Necessary schema addition

The existing report table has no department assignment column. An additive migration introduces nullable `reports.department_id`, its department foreign key (`ON DELETE SET NULL`), and an index. Existing rows stay null; no data is backfilled, reset or reseeded. All other authentication/report/history/assignment tables and existing migrations are retained. Category defaults remain reference data, not a substitute for an explicit report assignment. The schema has no staff-department membership model; any active verified maintenance staff member is eligible for an administrator's assignment.

Integration tests must use a verified separate Neon branch. They must never fall back to the application's `DATABASE_URL`. The additive migration must be validated on that branch before rollout to the application database.
