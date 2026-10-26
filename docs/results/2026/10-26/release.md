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

This records partial delivery. Database capacity, authenticated acceptance, native build/device verification and both store releases remain open; the original end-to-end project goal is not complete.
