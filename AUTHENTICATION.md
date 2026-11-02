# Phase 2 authentication

The existing schema, migration, reference data, and report UI are retained. No migration is required. Report operations, AI analysis, preferences, and profile edits remain frontend demonstrations; this task connects authentication and protects the existing workspaces.

## Compatibility and security

Installed-source inspection confirmed `next-auth 5.0.0-beta.32` and `@auth/drizzle-adapter 1.11.3` both depend on `@auth/core 0.41.3`. NextAuth supports Next 16, and the installed Next `16.4.3` authentication/Route Handler guides were read. The adapter is explicitly mapped to the existing UUID tables. Credentials requires `strategy: "jwt"`; registration persists users itself.

Auth.js handles encrypted HttpOnly, SameSite=Lax cookies (Secure on HTTPS), CSRF, and cookie clearing. Additionally, the existing sessions table stores a SHA-256 digest of a random session ID. Every session read checks the database row, absolute expiry, activation, verification, current role, and an HMAC of the current password hash. That password fingerprint also prevents reset/login races from leaving old credentials usable. Secrets/fingerprints are not exposed in public session JSON.

Sessions last **8 hours**, or **30 days** with Keep me signed in. Cookie renewal cannot extend the database deadline. Logout revokes the current session; password reset revokes all sessions. The client refreshes its session every 60 seconds/on focus; protected server requests validate immediately.

Registration always writes `student` and rejects privileged roles. Server checks protect `/student/*`, `/admin/*`, `/staff/*` using the corresponding database role (`maintenance_staff` maps to the existing `staff` UI). `/profile`, `/settings`, `/notifications` require authentication. New APIs/actions must call `authorizeApi`/`requireUser` themselves and check resource ownership when report APIs are implemented.

Email verification is mandatory. Inactive/unverified users cannot sign in or use existing sessions. Passwords use bcrypt cost 12, require at least 12 characters, and are limited to 72 UTF-8 bytes to avoid truncation. Password whitespace is preserved. Email casing/outer whitespace is normalized; existing mixed-case rows are recognized without rewriting data. Ambiguous legacy addresses fail closed and require operator review. Duplicate registration never modifies an account and returns a neutral message; recovery responses are also neutral.

Verification/reset tokens have 256 bits of randomness, are stored as SHA-256 hashes, purpose-separated, and consumed atomically. Verification expires in 24 hours; reset in 30 minutes. Reset tokens are bound to the password version; resetting invalidates all older reset links without bypassing verification. Links use URL fragments to avoid access logs/Referer leakage, and the client removes the fragment after reading it. GET requests do not consume tokens.

References: [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials), [Drizzle adapter](https://authjs.dev/getting-started/adapters/drizzle), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication). Installed source is authoritative for this beta.

## Configuration

The existing local environment contained `DATABASE_URL` and an insufficiently short `AUTH_SECRET`, with no email credentials. A fresh cryptographically random local secret was generated during implementation; the database connection was preserved. Add missing variables from `.env.example`. Provision a separate stable random secret in production.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing Neon connection, server only |
| `AUTH_SECRET` | Stable random secret, at least 32 characters |
| `APP_URL` | Canonical origin for links and request origin validation; HTTPS in production |
| `AUTH_URL` | Same canonical origin for Auth.js |
| `AUTH_EMAIL_PROVIDER` | `resend`, or local-development-only `file` |
| `AUTH_EMAIL_FROM` | Verified Resend sender |
| `RESEND_API_KEY` | Server-only Resend key |
| `AUTH_TRUST_HOST` | Enable only behind trusted infrastructure validating/overwriting Host headers |
| `BOOTSTRAP_ADMIN_EMAIL` | Temporary operator CLI input |

No production credentials are hardcoded. Never expose secrets with `NEXT_PUBLIC_*`. Provider errors return a retryable generic error, with no passwords/tokens/SQL parameters logged. An accepted API request does not establish inbox delivery; test delivery with your configured provider before release.

## Safe local email testing

1. Set `APP_URL=http://localhost:3000`, `AUTH_URL=http://localhost:3000`, and `AUTH_EMAIL_PROVIDER=file` in `.env.local`.
2. Run `pnpm dev` and register at `/register`.
3. Read the matching JSON in `.auth-outbox/` locally, open its verification link, and submit Verify email.
4. Sign in/out; request `/forgot-password`, open the reset link in the outbox, and choose a new password.
5. Delete development messages afterwards. They contain bearer secrets. The directory is ignored and never served over HTTP. Keep Windows workspace ACLs restricted to trusted users.

File delivery requires `NODE_ENV=development` and a loopback app origin; production rejects it. It writes local files and **does not send email**. A provider failure after registration leaves an unverified account; use Resend verification after correcting configuration.

## First administrator

Register an ordinary student and complete verification, then use an authorized operator shell with database access:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'your-verified-address@campus.edu'
pnpm auth:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL
```

No password is accepted by this command. It requires an active verified student with a password, refuses if any administrator exists, and uses a transaction-scoped advisory lock to serialize concurrent operators. Promotion, audit logging, and session revocation are atomic. Sign in again. There is no bootstrap HTTP endpoint. Later role provisioning requires an audited operator process; no public elevation/role-management API was added.

## Abuse controls and maintenance

Database-backed fixed-window limits work across workers: 10 login attempts/email/15 minutes; 5 registration/email/token requests/key/15 minutes; global 300 auth requests/minute. Identifiers are HMAC-obscured. Caller-supplied forwarding headers are not trusted. Namespaced slots reuse `verification_tokens`; primary-key collisions fail closed. Fixed windows permit boundary bursts, and malicious users can exhaust account/global limits. Configure infrastructure abuse controls appropriate to your deployment; these limits are not a DDoS defense.

Run `pnpm auth:cleanup` periodically from a trusted scheduler. It removes only expired sessions and expired owned token/rate-limit namespaces, never users/reference/report data. Auth.js clears cookies even when logout's database revocation fails; database-backed access fails closed during outages. Retry revocation after an outage if a stolen-cookie incident is suspected.

## Validation

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:auth
pnpm build
```

Integration tests start a local server on port 3100 with file delivery and a separate `.next-auth-tests` build directory, using the configured Neon connection. Prefer a separate Neon test branch for routine CI. They create random `auth-test-<uuid>@example.invalid` accounts and clean up only those users/tokens/outbox messages/audit records. They verify reference rows, report count, and migration count remain unchanged. Expiring global/token rate counters may remain for `auth:cleanup`. An interrupted run may need cleanup of its exact test accounts. Successful admin promotion is tested only if no admin exists; otherwise refusal is tested. Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a locally installed Chrome executable. Next can regenerate its type declarations when switching between development/test/build modes; run the normal build after tests.

Traces/screenshots are disabled to avoid retaining secrets. The integration outbox proves local email generation, **not external delivery**. No Gemini integration, report API, or deployment is included.
