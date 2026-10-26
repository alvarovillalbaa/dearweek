# Welyto release evidence — 26 October 2026

Current product and deployment state is maintained in [Dearweek's rename and polish receipt](dearweek-release.md). Dearweek's new origin, contact/library improvements and version 2 deletion passed their scoped checks; final fixture counts are zero. Photo, email and native release gates remain open.

The Welyto URLs, version 1 function metadata and observations below preserve the pre-rename stage: all 37 PostgreSQL groups passed, and the earlier two-account workflow verified sign-in, persisted family memories/profile, admin invitation/privacy boundaries and deletion without uploaded objects. It is historical evidence rather than current naming or function-version configuration.

## Backend and Auth before the Dearweek cutover

| Surface | Verified state |
| --- | --- |
| Dedicated project | `faftywddybmgamvseibe`, Clous organization, `eu-central-1`; healthy. API origin: `https://faftywddybmgamvseibe.supabase.co`. Welyto has its own identity and family-data boundary. |
| Canonical migration | Remote version `20261026193912`; [source migration](../../../../supabase/migrations/20261026193912_initial_family_memories.sql). SQL SHA-256 `09a9ff86a231716188a5b9f6dca77915d6c94658c43986b16d25537439257a0a`. The CLI-created local filename was aligned to the applied remote version without changing SQL. |
| Tables and policies | Nine public and three private application tables; RLS enabled on all 12. Advisor readback: three informational notices for private tables with RLS and no client policies; no warnings. |
| Photo storage | Private `memory-photos` bucket; maximum 8 MiB; JPEG, PNG and WebP. SQL acceptance covers reservations and missing-object rejection, not real uploads or original-photo delivery. |
| Auth URLs | Site URL `https://welyto.vercel.app`; allowed returns `https://welyto.vercel.app`, `https://welyto.vercel.app/`, `https://welyto.vercel.app/auth/callback` and `welyto://auth/callback`. Saved and verified after reload: [dashboard capture](auth-urls-saved.jpg). |
| Auth providers | Confirm email checked; anonymous sign-ins unchecked; Email enabled and other providers disabled. Dashboard readback required no setting changes: [confirmation capture](auth-confirmation.jpg). |
| Public email delivery | Unverified. `emailDeliveryVerified` remains false; signup, resend and recovery-email requests remain gated. Existing confirmed accounts retain sign-in. No SMTP or email-ownership proof is inferred from administrative fixtures. |

The owner approved the [free-capacity consolidation](../../../proposals/2026-10-26-free-capacity.md). Still and Kickoff now share active project `wosqlzijmyiemueoittw`; the retired Kickoff backend `lucbdtdsofnybynjpdbp` is `INACTIVE`. Their cutover, shared-account policy and 28-group regression proof belong to [Kickoff's canonical receipt](https://github.com/alvarovillalbaa/kickoff/blob/main/docs/results/2026/10-26/shared-backend.md). Welyto uses the freed second slot and remains isolated from those accounts.

At this Welyto stage, both deletion Edge Functions were `ACTIVE`, version 1, with `verify_jwt=true`:

| Function | Deployment identity | Deployment SHA-256 |
| --- | --- | --- |
| `delete-account` | `34555f75-0e7e-49dd-b9b4-ab4a5170a83a` | `52398e58e10075be04ef8007b87ddba5330be1513ccc440ec4d7fd1aa68d134c` |
| `delete-family` | `147a66ee-fd8c-45f4-8daa-a986bb4cea39` | `c8a45fc3ea71c3c21dac89df15798ee89f93c2a7826352a9037340202a450782` |

The functions explicitly verify the caller with Auth and keep the administrative key server-only. Actual authenticated app calls to both functions completed: the admin account deletion preserved the owner's family and two memories; the owner then deleted the family and their own account. [Runtime observations and post-query counts](runtime-checks.md) establish cleanup without uploaded objects. Deletion with real photo objects, injected failures and retry behavior remain unverified.

## Database acceptance

The [executed receipt](access-acceptance.json) records a successful single-payload run of [tests/access-acceptance.sql](../../../../tests/access-acceptance.sql): **37/37 groups passed** at suite SHA-256 `4a63e6ee11643d0f50203f7eb3df419d34115b8b97aae9d1b98289c8656ca076`.

The suite used six reserved synthetic Auth identities, including an unverified account, and actual PostgreSQL `authenticated`/`anon` roles with transaction-local claims. It exercised invitation hashing/email matching, family roles, private/selected/family audiences, immutable editor authority, membership removal, owner constraints, 20-photo reservations, missing-object completion failures, and pending account/family deletion guards. Deferred owner constraints ran before rollback. Catalog snapshots matched; no Storage objects were fabricated or mutated.

All SQL fixtures rolled back, and a separate post-query reported zero Auth accounts and application data at that check. Two explicitly confirmed disposable accounts were then created through the dashboard's Create User action for runtime QA; no invitation or SMTP message was sent. That later workflow also completed its teardown through the app. The final [runtime post-query](runtime-counts.json) reports zero Auth accounts, all 12 application tables and photo objects. These are dated post-checks rather than a guarantee that future data remains empty.

The first suite attempt failed to compile with SQLSTATE `42601` before creating fixtures. Parenthesizing three CASE expressions fixed the test; independent counts remained zero before the successful rerun. No production-schema change was required.

This establishes installed database grants, RLS, sequential RPC authorization and metadata constraints. Simulated claims and direct fixture creation do not prove public signup, JWT validation, Auth sessions, email delivery, HTTP/Edge behavior, real photo upload/download/deletion, or concurrent clients.

## Published source and browser evidence before the rename

Public repository: [alvarovillalbaa/welyto](https://github.com/alvarovillalbaa/welyto). Public web origin: [welyto.vercel.app](https://welyto.vercel.app). Vercel project: `prj_ASLXJm4PxO3g5rLQilEO2uQDUaAc`.

| Published source | Hosted evidence |
| --- | --- |
| Initial `9676b087e592f3212041234bd2fc56a368dcb6d2` | `dpl_Cot6p2t17hVvT6CBRRC6f38pSBCR` reached `READY`; hosted Node 24 TypeScript check and Expo web export succeeded. |
| Locked build `5dde64191cec4edc6c4f3051e97e7098175b882c` | `dpl_C514171iobWW8jTTDo1DCM9TnBZc` reached `READY`. Direct privacy/deletion routes initially returned 404; this is historical failure evidence. |
| Route fix `6c277bc45dfc7d20166a0084dec52a81f157a86b` | `dpl_FDnjFB62rGFC8JA4gPEQt43K1AC5` reached `READY`; `/privacy`, `/delete-account` and `/auth/callback` returned HTTP 200 and the app shell. Temporary `/dependency-lock.json` returned 404 after its removal. |
| History fix `cc04b1c80caeab8a99e6115c0b58963a9aaf4497` | `dpl_HKhzyZ57objLD8wxf7eawo2A7cJG` reached `READY`; desktop/mobile URL/heading Back/Forward checks passed in [the public browser receipt](browser-checks.md). |
| Previous verified production `5540b8b` | `dpl_HqcTUcd3r42G5YTmeZMFFvw5ZJzE` reached `READY`. |
| Connected source `ccba2ff91f7f35cbdfa0387ce0fe65924acbcbe5` | Production `dpl_HectVVhwzLe7Cchhwmggd3S2d3Uy` reached `READY`; authenticated runtime checks passed within the scope below. Includes the dedicated public project settings, profile payload correction, migration filename alignment and suite parser fix. |

The public browser receipt covers the earlier service-unavailable state, public navigation and history fix. Its backend-capacity statements describe that earlier check, not the current provisioned state. It contains no authenticated family, invitation, photo or deletion acceptance. Browser viewport overrides are not native-device proof.

The separate [authenticated runtime receipt](runtime-checks.md) records actual password sign-in, a `Europe/Madrid` family, profile rename and private/family memories surviving a full reload, an email-bound admin invitation, admin exclusion from the private story/person, and no Edit/Archive controls on the admin's shared-story detail. Authenticated desktop/mobile views matched widths 1440/390. Both deletion functions completed without uploaded objects, and final counts confirm complete fixture teardown through the app. Signup, resend and reset-email actions stayed disabled while delivery remained unverified. The two chooser attempts, including one after the user enabled file-URL access, failed at Chrome's extension permission boundary; no photo rows or objects were created.

The first hosted install produced the committed lockfile: 521 package entries, 248,440 bytes, SHA-256 `0aed2a47770c48a47183a73d25cb425484f25faddaadaedbcf6089af92ff5ce3`; direct dependency versions matched `package.json`. Subsequent hosted builds use `npm ci`. The temporary lock export was removed.

## Historical blockers and remaining gates

The initial `$0/month` project request was rejected because two free projects were active. It created no Welyto resources. The later approved consolidation and dedicated provisioning resolved that capacity blocker without a paid plan; earlier pending-capacity narratives are superseded by the current backend state above.

An earlier Storage Guard measured 31.3 GiB free against 34.0 GiB required. No local dependency install, app build, simulator environment or test database was created. Remote build results and database execution are recorded separately; no current storage measurement is implied.

The source still follows the brief's four requirements: weekly family contributions, admin/custom access, structured memories, and iOS/Android store apps. One Expo SDK 58 application supplies iOS, Android and web; [the product contract](../../../spec.md), [access model](../../../access-model.md), and [native release instructions](../../../native-release.md) remain canonical.

Remaining acceptance:

- Verify additional viewer/selected-recipient browser combinations, concurrent changes, failures and retries beyond the completed owner/admin workflow.
- Resolve the supported browser file-access blocker, then verify real photo upload, completion, authorized original download, removal and removed-member denial through Storage.
- Verify deletion with actual photo objects and failure/retry handling; the completed runtime deletion path had no uploaded objects.
- Configure owner-supplied SMTP and prove confirmation/recovery delivery before enabling public email actions.
- Produce signed native binaries, test iOS/Android devices, finalize store/privacy details and complete both store reviews.

At this earlier check, local tooling/account markers were absent and the Expo browser page was signed out, so native account availability was unknown. The owner later confirmed that no Expo account exists; Apple/Google ownership remains unknown. The [current Dearweek receipt](dearweek-release.md) records that later input. No account enrollment or signing action occurred.

The original end-to-end release goal remains incomplete.
