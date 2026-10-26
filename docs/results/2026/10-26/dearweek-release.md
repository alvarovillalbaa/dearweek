# Dearweek rename and polish — 26 October 2026

Dearweek is published at [dearweek.vercel.app](https://dearweek.vercel.app), source `6bd72d9e0f55c4d40c12cb9dd54a630071356d28`, production deployment `dpl_BPYF6D8X3S5ThPQsrHJDRCoyANRn` in `READY`. The renamed app, contact UI, family/library improvements and authenticated deletion were checked on this origin. [Final runtime counts](dearweek-runtime-counts.json) show zero Auth accounts, all 12 application tables and photo objects after app-driven teardown. Photos, public email delivery and native store releases remain incomplete.

## Cutover and unchanged contracts

- GitHub is now [alvarovillalbaa/dearweek](https://github.com/alvarovillalbaa/dearweek), repository ID `1434752341`; the remote and local checkout directory were updated. Vercel retains project `prj_ASLXJm4PxO3g5rLQilEO2uQDUaAc`, now named Dearweek, with the new domain verified and assigned.
- Supabase project `faftywddybmgamvseibe` is healthy and labelled Dearweek. The database, applied migration and authorization contract were preserved. The existing [37-group PostgreSQL pass](access-acceptance.json) was not rerun during this rename.
- Site URL is `https://dearweek.vercel.app`. The four exact Dearweek returns—origin, trailing slash, `/auth/callback` and `dearweek://auth/callback`—were saved and survived reload. The four earlier Welyto returns were retained for compatibility: [Auth URL capture](dearweek-auth-urls.jpg). Persisted URLs do not prove real email callback delivery.
- Original migration/policy names, SQL fixtures, historical receipts and `welyto.pending-invitation` remain intentional provenance or compatibility names. Current user-facing branding is Dearweek.
- Both deletion functions are `ACTIVE`, version 2, with `verify_jwt=true`; the redeployment changed the public site URL. IDs and provider `ezbr_sha256` values are preserved in [the runtime receipt](dearweek-runtime-counts.json).

| Function | ID | Version 2 EZBR SHA-256 |
| --- | --- | --- |
| `delete-account` | `34555f75-0e7e-49dd-b9b4-ab4a5170a83a` | `3afa87cb86ba722f7f2f0bddfde9eb36313b7c5c6c1be2b20ec8dc84289f93ef` |
| `delete-family` | `147a66ee-fd8c-45f4-8daa-a986bb4cea39` | `3994f46a3a9564abb1330a6e455a568a9506ecd9a37c88f157dee361ca0bcd95` |

## Observed acceptance

| Check | Result |
| --- | --- |
| Public routes | `/`, `/contact`, `/privacy`, `/delete-account` and `/auth/callback` returned HTTP 200. This includes app-shell routing, not a real email-recovery exchange. |
| Onboarding and brand | New desktop/mobile onboarding screenshots were visually reviewed: [desktop](dearweek-onboarding-desktop.jpg), [mobile](dearweek-onboarding-mobile.jpg). The authored D/leaf SVG and rendered icon assets were inspected. No fake family photographs were introduced. |
| Support and history | The actual contact UI shows `alvaro.villalbaperez@icloud.com` and explains that a draft opens for review/send in the user's email app. An empty form produced three required-field errors. Direct `/contact` and reload passed; supported browser Back/Forward returned matching `/privacy` and `/contact` headings/paths: [mobile capture](dearweek-contact-mobile.jpg). No email app was opened and no message was sent, so mail-client handoff and delivery are unverified. |
| New-origin account/family | One fresh disposable confirmed owner signed in and created a family with a long name. At mobile width 390, document width remained 390 and the name visibly wrapped: [family capture](dearweek-family-mobile.jpg). This was the third runtime fixture account overall, created sequentially after the earlier pair had been removed. |
| Library | One saved story displayed its family audience visibly and in the accessibility tree. An unmatched query showed No results; Clear filters restored the story; a whitespace-only query kept it visible. Mobile viewport/document widths were both 390: [library capture](dearweek-library-mobile.jpg). This is browser accessibility-tree evidence, not assistive-technology testing. |
| Version 2 teardown | The owner deleted the fixture family/story through the actual family-deletion function, then deleted their account through the account-deletion function and was signed out. The final [14 count fields](dearweek-runtime-counts.json) are all zero. No manual SQL cleanup was used. There were no uploaded objects in this deletion check. |

An initial keyboard history shortcut did not navigate; the documented browser tab Back/Forward operations completed the actual check. The browser was left on a clean sign-in screen after teardown.

The earlier [Welyto runtime receipt](runtime-checks.md) remains evidence for profile/memory reload persistence, email-bound admin invitation and private-story/person exclusion. The [original release record](release.md) preserves provisioning, SQL and earlier deployment history; those historical names and version 1 metadata describe that earlier stage.

## Limits and final follow-up

The supported photo picker was tried from a freshly attached tab after older tabs were reported as detached from the debugger. File-URL permission was still denied. No bypass or upload followed, and no photo row or Storage object was created. Actual photo upload/completion/download/removal, removed-member original access and deletion with real objects remain unverified.

The owner supplied a support recipient, not SMTP configuration. `emailDeliveryVerified` remains false; confirmation stays enabled and public signup/resend/reset-email actions remain gated. No real confirmation or recovery delivery has been established. The contact form prepares a user-sent draft; it is not an application email service.

The owner explicitly confirmed that no Expo account exists. Apple/Google developer-account ownership remains unknown, native identifiers remain unregistered, and no enrollment, signing, native binary/device acceptance or store submission occurred. No dependencies were installed and no local app build ran. Web viewports and rendered icon assets do not establish native release readiness.

Follow-up source `480120811c555f67935ee6f0920d85574c3ab655` clears the stale saved-memory notice when a family is removed and publishes the acceptance evidence. Its production deployment `dpl_2zxCaam7MCfkkb5RKXwt1yrrak3S` reached `READY` with the Dearweek domain assigned. Hosted TypeScript checking and Expo web export passed; receipt JSON, exact dependency-lock metadata, both unchanged SQL hashes and whitespace checks also passed. No additional authenticated workflow is claimed for that small notice change. Additional viewer/selected-recipient browser combinations, concurrency and injected failure/retry behavior remain outside these checks.

The original end-to-end goal is still incomplete. Complete photo, email and native acceptance through the [native release gates](../../../native-release.md) before claiming full delivery.
