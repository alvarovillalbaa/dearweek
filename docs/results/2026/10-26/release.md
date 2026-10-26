# Welyto release evidence — 26 October 2026

## Source scope

The live Notion brief supplied exactly four requirements: weekly family contributions, admin/custom access, structured memories, and App Store/Google Play apps. The implementation is one Expo SDK 58 application for iOS/Android/web, not a separate web-only substitute. See [the product contract](../../../spec.md), [access rules](../../../access-model.md), and [native release gates](../../../native-release.md).

## Supabase provisioning result

The owner selected the Clous organization and explicitly accepted the tool's `$0/month` project quote. Provisioning Welyto in `eu-central-1` was attempted after that confirmation. Supabase rejected the request because this account already owns/administers its maximum of two active free projects. The active projects are Still and Kickoff. Neither was paused, reused, deleted or upgraded; no Welyto project, schema, Auth configuration, object bucket or function deployment was created by the rejected request.

The owner has been asked whether they will enable a paid Supabase plan or authorize pausing one specifically named existing service. That decision is pending. A zero project quote did not establish available free-project capacity. The client therefore shows that account/saving services are unavailable until a dedicated backend exists.

## Checks and limits

- Source and whitespace inspection completed during implementation. The database architecture received an independent source review; fixes cover duplicate-invitation re-entry after removal, viewer edit-grant cleanup, retryable deletion discovery, exact photo bucket naming and deletion response shape.
- Storage Guard measured 31.3 GiB free against 34.0 GiB required including the reserve. No local dependency installation, app build, simulator environment or test database was created.
- The CLI created the initial migration scaffold with its documented task-local `SUPABASE_HOME` state directory. It did not change the system home or access another project's credentials.
- Backend tests and browser checks have not run for Welyto. The earlier explicit acceptance authorization concerned Agent Library and was not reused here.
- Auth delivery, authenticated cross-family access, photo round trips, deletion, signed native builds, device behavior and store publication are unverified.

## Published source and hosted build

- Public repository: [alvarovillalbaa/welyto](https://github.com/alvarovillalbaa/welyto), initial source commit `9676b087e592f3212041234bd2fc56a368dcb6d2` on `main`.
- Public web origin: [welyto.vercel.app](https://welyto.vercel.app). Vercel project `prj_ASLXJm4PxO3g5rLQilEO2uQDUaAc` is connected to that repository; production deployment `dpl_Cot6p2t17hVvT6CBRRC6f38pSBCR` reached `READY` with that exact source commit.
- The hosted Node 24 build ran `tsc --noEmit && expo export --platform web && node scripts/finalize-web.mjs` successfully. Metro exported the app and its icon font. This establishes frontend compilation/export, not SQL/Edge compilation, browser acceptance or native binaries.
- The first hosted install produced the exact committed dependency lock: 521 package entries, 248,440 bytes, SHA-256 `0aed2a47770c48a47183a73d25cb425484f25faddaadaedbcf6089af92ff5ce3`. Every direct dependency/dev dependency matches `package.json`. The lock was retrieved from the hosted deployment through the Vercel connector after the local shell could not resolve the new deployment hosts; no local dependency install ran.
- The temporary dependency-lock export was removed from the build script, and subsequent builds use `npm ci`. A small owner-settings copy correction avoids inferring that a reduced pending-deletion roster proves a family has only one member.
- The locked production build `dpl_C514171iobWW8jTTDo1DCM9TnBZc` reached `READY` at commit `5dde64191cec4edc6c4f3051e97e7098175b882c`. HTTP checks through the Vercel connector returned 200 for `/` but 404 for direct `/privacy` and `/delete-account` requests. The routing fix uses explicit rewrites for those public routes and `/auth/callback`; its hosted recheck follows below. HTTP responses do not establish client rendering or authenticated behavior.
- Vercel's [`cleanUrls` rewrite contract](https://vercel.com/docs/project-configuration/vercel-json#rewrites) requires extensionless destinations. The final explicit rewrites target `/`, which already serves the app shell, rather than the incompatible `/index.html` destination.
- The repaired production deployment `dpl_FDnjFB62rGFC8JA4gPEQt43K1AC5` reached `READY` at source commit `6c277bc45dfc7d20166a0084dec52a81f157a86b`. Vercel connector HTTP rechecks returned 200 and the app shell for `/privacy`, `/delete-account` and `/auth/callback`; `/dependency-lock.json` returned 404 after the bootstrap export was removed. No browser check was used to establish these HTTP results.

The task-local initial CLI telemetry state was removed after the migration scaffold was created; no credentials or existing provider login state were removed.

## Approved checks and free-capacity resolution

The owner subsequently approved Welyto's focused browser/backend checks, ruled out a paid plan, and approved [consolidating Still and Kickoff](../../../proposals/2026-10-26-free-capacity.md) with confirmed-email signup before retiring the unused Kickoff backend. Still/Kickoff will share one identity space; Welyto will remain in its own project. This supersedes the earlier pending capacity decision above, not the end-to-end proof limits.

Approved public browser checks found and fixed a history-state defect at commit `cc04b1c80caeab8a99e6115c0b58963a9aaf4497`, production deployment `dpl_HKhzyZ57objLD8wxf7eawo2A7cJG`. Actual desktop/mobile Back/Forward and public setup-state results are recorded in [the browser receipt](browser-checks.md); authenticated family screens remain unavailable until backend provisioning.

Kickoff's schema was installed additively in Still's project after rechecking zero accounts/records. Still's grants, RLS policies, existing public RPCs and private function definitions/ACLs compare identical before and after. Current provider/cutover evidence is maintained in [Kickoff's owner receipt](https://github.com/alvarovillalbaa/kickoff/blob/main/docs/results/2026/10-26/shared-backend.md). Auth redirect setup needs the owner's Supabase dashboard login because the connector lacks an Auth-settings endpoint and the task browser is signed out. Neither existing backend has been paused yet.

The main session subsequently resumed the existing GitHub login, completed the shared Auth URL setup, and verified it after reload. Still's default localhost Site URL and empty allowlist were replaced with its production origin and four exact Still/Kickoff callbacks. Confirmation remains required. Kickoff's `7b301cb` production build is `READY`; its served bundle uses only the shared project and contains no retired-project reference. The shared PostgreSQL suite passed 28 groups and independently returned zero residual accounts/records. Final public browser checks precede pausing the retired backend.

Welyto's 37-group rollback-only access suite is authored and independently source-reviewed at SHA-256 `2eae6c5ca6d1f75338c9080d0c2eed90431e4b16fba8c111c78c5c9a8044643c`; it has not run because the dedicated backend does not exist yet. The public settings module remains empty for URL/key until provisioning. Email delivery stays unverified, so the prepared Auth UI gates signup/resend/recovery emails while retaining confirmed-account sign-in. Source preparation does not establish working Auth, Storage or Edge deletion.

This records partial delivery. Database capacity, authenticated acceptance, native build/device verification and both store releases remain open; the original end-to-end project goal is not complete.
