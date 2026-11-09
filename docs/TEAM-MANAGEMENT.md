# Team accounts and department assignments

Admins manage accounts at **Admin → Team management** (`/admin/team`). Public registration still creates students only.

## Create a worker or administrator

Choose the Workers or Administrators tab, then Add worker / Add administrator. Enter a name, unique email, and a temporary password of at least 12 characters. A worker must have one active department. Administrators have no worker department and receive the same permissions as other administrators, including creating additional admins.

The form can generate a random temporary password. After saving, the browser displays the sign-in details until dismissed; the server stores only a bcrypt hash and never returns a stored password. Share the credentials privately. No invitation or password email is sent by this workflow.

Admin-provisioned accounts can sign in without student registration. `admin_provisioned` records that trust separately from `email_verified`; creating an account does not claim that its mailbox has been verified. At first login, all protected pages redirect to `/change-password` and workspace APIs reject requests until a different password is chosen. This restriction also applies to Google sign-in. Changing the password revokes previous sessions and requires a fresh login.

## Assign work

Open a report, select Responsible department, choose a worker, and click Assign work. The list shows active workers in that department with their names, email addresses, and open-task counts. The application saves account IDs, so duplicate names are supported. Switching departments clears the selection. Reports can remain unassigned if no eligible worker is available.

Saving an assignment updates the report, assignment history, audit record, and worker/student notifications in one database transaction. Assignment sets the status to Assigned. Reassignment ends the previous assignment; workers can access only their currently assigned reports. Closed, resolved, or rejected reports must be reopened before assignment.

Workers use Assigned → In Progress → Resolved and can add work notes. The UI waits for the server before showing success. Report versions prevent two competing updates from silently overwriting each other.

## Account maintenance

- A worker's unfinished tasks must be reassigned before changing departments or deactivating the account.
- Deactivation preserves history and revokes sessions. Reactivation restores sign-in eligibility.
- Reset temporary password revokes sessions and requires another first-login password change.
- Admins cannot manage their own access through this screen. Another active admin must remain available; server checks run inside the account-change transaction.
- Existing workers are preserved with a null department until an administrator assigns one. They can finish work already assigned before the migration, but new assignments require department membership. No workers or admins are automatically created by the migration.

Account changes and assignment transactions share a database lock so a worker cannot be deactivated or moved between the eligibility check and the assignment write. Team endpoints are admin-only, require same-origin JSON for mutations, validate bounded request bodies, and rate-limit account changes. Passwords are excluded from audit metadata and API responses.

## Database and deployment

Migration `drizzle/0003_team_accounts.sql` adds `users.department_id`, `users.must_change_password`, `users.admin_provisioned`, the department foreign key, and its index. Existing records keep their previous behavior because the flags default to false and the department is nullable.

Apply migrations with `npm run db:migrate` before deploying the new code to another database. Keep `APP_URL` and `AUTH_URL` aligned with the deployed origin. This implementation does not change environment secrets or create permanent accounts.

## Verification

- `npm test` includes account-input, permission-policy, and report validation tests.
- `npm run test:team` exercises real login, provisioning, first-password changes, assignment eligibility, concurrent updates, worker lifecycle, deactivation, password resets, and additional-admin access. It uses the configured database and creates randomly named fixture accounts, departments, a building, and a report; cleanup targets only that run's fixture records. Use a dedicated test database when available. Auth rate-limit counters expire normally.
- `node node_modules/@playwright/test/cli.js test -c playwright.location.config.ts team-ui.spec.ts dashboard.spec.ts` checks the mobile assignment form, department filtering, duplicate-name identities, failed-save feedback, admin access confirmation, and dashboard regressions using mocked APIs.

The older report database suite (`npm run test:reports`) retains its separate `TEST_DATABASE_URL` requirement. Completion-photo previews and profile/preferences persistence are outside this account-management change.
