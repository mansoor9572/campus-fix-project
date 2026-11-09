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

The report department migration adds nullable `reports.department_id`, its department foreign key (`ON DELETE SET NULL`), and an index. Existing rows are preserved. Migration `0003_team_accounts.sql` additionally connects each worker to a department through `users.department_id`. Assignments require an active worker in the report's selected active department. Existing workers need an administrator to configure their membership. Category defaults remain reference data, not a substitute for explicit assignment. See [Team management](docs/TEAM-MANAGEMENT.md) for account provisioning, first-login password changes, and assignment behavior.

Integration tests must use a verified separate Neon branch. They must never fall back to the application's `DATABASE_URL`. The additive migration must be validated on that branch before rollout to the application database.
