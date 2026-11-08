# UMY building directory and report locations

Implementation and local validation completed on 8 November 2026. The SQL migration and directory seed are prepared but **have not been applied to any database**. No production deployment was performed. Database integration tests remain pending because a separate Neon test branch is not available.

## Student flow

1. Search the database-backed building directory by name, building code, faculty, or an alternative name, then select a result.
2. Type a required floor number or name (1–60 trimmed characters).
3. Type a required room number or name (1–100 trimmed characters).
4. Optionally enter additional location details (up to 500 trimmed characters).

There are no floor/room dropdowns or room-directory dependencies. Search is case-insensitive and supports partial English/Indonesian names, aliases, and multiple query words. Exact code matches rank first. Clearing or changing the search clears the selected building ID. Keyboard arrows, Enter, and Escape are supported. Loading failures show Retry; unmatched text cannot be submitted as a building.

The small directory is loaded from the authenticated `/api/buildings` endpoint and filtered instantly in the browser. Building codes, names, and internal directory identifiers have database indexes. Basic search does not call an AI API.

Submission uses the actual building UUID. The form awaits successful server persistence before showing success or navigating away; failed saves retain the entered values. Existing image upload and triage behavior is retained. No new Gemini integration was added.

## Database compatibility

Migration: `drizzle/0002_umy_directory_report_location.sql`, with matching Drizzle snapshot/journal.

- `reports`: adds nullable `floor`, `room_number`, and `additional_details` text columns. Existing rows and foreign keys are retained. The old `room` column is kept intact; new reports also mirror the room number into that column for older readers. No attempt is made to guess a floor or split historical free text.
- `buildings`: keeps existing UUIDs, names, descriptions, and activation fields; adds an internal `directory_key`, Indonesian name, alias array, faculty association, building type, map URL, optional coordinates, verification status, and source URL. Building code becomes nullable so unknown codes are not invented.
- New report requests require the separate fields; old stored reports remain readable and can receive status updates without needing location backfills. Legacy `room` edits remain available on legacy rows. Mixing legacy and structured location edits is rejected.
- Student lists/details, admin lists/details, maintenance task views, search, and CSV export include the new location fields. CSV exports floor, room number, and additional details in separate columns. Missing historical details fall back to the original `room` text.

## Initial directory: 27 prepared entries

All entries below are **unverified**. They come from the user-supplied initial directory, not a newly verified official register. No coordinates or map URLs were invented. English display names, Indonesian names, supplied aliases, and associations are included in the seed. A dash means no confirmed building code was supplied.

| Display name | Code |
| --- | --- |
| A.R. Fachruddin A | — |
| A.R. Fachruddin B | — |
| Admisi Building | — |
| KH. Mas Mansyur Building | — |
| Ki Bagus Hadikusumo Building | — |
| KH. Ibrahim Building | — |
| Kasman Singodimedjo Building | — |
| Siti Walidah Building | — |
| Djarnawi Hadikusuma Building | — |
| Dasron Hamid Research Center | — |
| Faculty of Social and Political Sciences | — |
| Faculty of Engineering | — |
| Faculty of Economics and Business | — |
| Faculty of Language Education | — |
| UMY Library | D (supplied, unverified) |
| Engineering Building F1 | F1 |
| Engineering Building F3 | F3 |
| Engineering Building F4 | F4 |
| Engineering Building F6 | F6 |
| Sportorium UMY | — |
| Student Center UMY | — |
| UMY Student Dormitory | — |
| UNIRES | — |
| Perdana UMY Hotel, Convention & Dormitory | — |
| KH. Ahmad Dahlan Mosque | — |
| UMY Boga | — |
| Lapangan Bintang | — |

UMY facilities management should confirm the official names, faculty/department associations, F1/F3/F4/F6 functions, the library's reported Gedung D location, and whether accommodation entries represent distinct facilities. Coordinates and Google Maps destinations need verification before being shown as navigation links.

## Administration and seed behavior

`/admin/buildings` is protected by the existing server-side admin route policy. Create/update API handlers and the service also require the admin role. Students and staff can read active entries but cannot edit them or request inactive entries. Directory writes check the request origin.

Admins can maintain names, codes, aliases, faculty/type, descriptions, map URLs, coordinates, source URLs, verification status (`verified`, `unverified`, `historical`), and activation. Verified entries require an authoritative source URL. Coordinates require verified status. Deactivating an entry prevents new selection without deleting historical report relationships. Floors and rooms are intentionally not administered.

`scripts/seed-umy-buildings.ts` previews by default. With `--apply`, it matches internal keys, supplied codes, and normalized names/unique aliases. Matching rows are enriched while retaining their IDs and existing metadata. Ambiguous matches stop the seed for review. Re-running it skips rows already associated with the seed's stable keys, preserving subsequent admin edits. There are no deletions or truncate operations.

## Validation results

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit --incremental false`) | Passed |
| Unit tests (auth, reports, uploads, AI, buildings/location) | 36 passed |
| Isolated Playwright browser tests | 6 passed |
| ESLint | Passed with existing image-element warnings |
| Next.js production build | Passed |
| Database integration runner | Skipped: no separate `TEST_DATABASE_URL` |
| Live migration, seed, persistence and authorization integration | Not executed; pending test branch |

The browser fixture is a separate Next app under `tests/fixtures/location`, not a production route. It runs the real UI components with mocked session/API data and does not connect to Neon. Browser checks cover the supplied search examples, empty results, clear/keyboard selection, required fields, separate request fields, optional details, length limits, mobile overflow, failed saves, directory failures, admin metadata, and legacy/new location display across all roles. It proves browser behavior, not live database persistence.

Screenshots use synthetic test data:

- [Desktop building search](screenshots/umy-building-search-desktop.png)
- [Mobile report form](screenshots/report-location-mobile.png)

## Test branch and rollout steps

1. Create a separate Neon test branch and add its connection string as `TEST_DATABASE_URL` in `.env.local`.
2. Run `npm run test:reports`. The runner refuses the main database endpoint, switches its child processes to the test branch, applies migrations there, seeds reference data/UMY entries, and runs database integration tests. Direct integration test invocation without `TEST_DATABASE_URL` skips the tests. The runner does not use Gemini credentials.
3. After database checks pass, apply the migration to the intended deployment database using `npm run db:migrate`. Ensure `DATABASE_URL` targets that database.
4. Preview the directory changes with `npm run db:seed:umy`; review any matching/ambiguous records. Apply with `npm run db:seed:umy -- --apply`.
5. Release the application only after migration and seeding. Until then, the updated source expects columns that are not present in an unmigrated database.

Other repeatable checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:location-ui`, and `npm run build`. Local checks in this session invoked the installed Node binaries directly because the machine's pnpm launcher points to a missing Corepack file.
