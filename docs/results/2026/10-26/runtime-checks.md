# Authenticated runtime checks — 26 October 2026

The approved live checks ran at [welyto.vercel.app](https://welyto.vercel.app) against dedicated project `faftywddybmgamvseibe`, source commit `ccba2ff91f7f35cbdfa0387ce0fe65924acbcbe5`, and `READY` production deployment `dpl_HectVVhwzLe7Cchhwmggd3S2d3Uy`. These observations use the actual web UI, Auth sessions, database and deployed deletion functions. The separate [37-group SQL receipt](access-acceptance.json) covers simulated database request contexts.

Two disposable accounts were explicitly confirmed through the Supabase dashboard's **Create User** action. This sent no invitation or SMTP message; global email confirmation remained enabled. Passwords stayed in task memory and are not recorded here. This setup does not establish signup, email ownership or delivery.

## Observed workflow

| Check | Result |
| --- | --- |
| Owner sign-in and profile | Actual email/password sign-in succeeded. Creating a family with `Europe/Madrid` succeeded. Renaming the profile to `QA Owner` succeeded. |
| Memory persistence | The owner saved one private and one family-visible memory, including memory date, place, people and tags. A full reload retained both memories and the updated profile. |
| Email-bound invitation | The owner created an admin invitation and signed out. Opening its link, signing in with the matching invited email and explicitly accepting joined the same family. The roster showed two members and the accepted admin role. No invitation email was sent by the app. |
| Admin audience and controls | The admin saw only the shared story; the private story and its private person name were absent. The shared detail exposed no Edit or Archive controls. Admin membership did not grant access to the owner's private content or editing rights over the shared memory. |
| Admin account deletion | The admin confirmed **Delete My Account**. The deployed account-deletion function completed and the app signed out. A read-only post-query found zero Auth/profile/membership rows for that account, while the owner's family and two memories remained. |
| Owner responsive views | The owner signed in again. Authenticated family/settings views rendered at desktop width 1440 and mobile width 390, with document width equal to each viewport. [Desktop capture](runtime-desktop.jpg) and [mobile capture](runtime-mobile.jpg). Viewport overrides were reset afterward. These are browser viewports, not physical device checks. |
| Family deletion | The owner entered the exact family name and confirmed deletion. The deployed family-deletion function completed. The intermediate readback showed zero families, memories, memberships and photos, with one owner Auth account remaining. There were no uploaded photo objects to remove. |
| Owner account deletion | The owner then confirmed **Delete My Account**. The app signed out after the deployed account-deletion function completed. The final [runtime counts](runtime-counts.json) show zero rows across Auth, all 12 application tables and the photo bucket's objects. |
| Email-action gate | **Create Account**, **Resend** and **Send reset link** were disabled in the actual UI while `emailDeliveryVerified=false`. Real confirmation/recovery delivery remains unverified. |

All fixture teardown used the application's family/account deletion paths. No manual SQL cleanup was used; runtime SQL queries read the resulting counts. The member-deletion preservation check and final zero counts are persisted in [runtime-counts.json](runtime-counts.json).

## Photo check blocked by browser file access

The supported system chooser selected the authored `assets/icon.png` for a photo attempt. Chrome reported that the browser extension required **Allow access to file URLs**. After the user confirmed enabling that permission, one further supported attempt returned the same permission error. Work stopped at that boundary without bypassing access controls or entering a retry loop.

No photo row or Storage object was created. The failure therefore does not establish that the app accepted or rejected image bytes. Actual upload/re-encoding, completion, authorized original download, removal, removed-member Storage denial, and deletion with real objects remain unverified. The successful family/account deletion checks above cover accounts and families without uploaded objects.

## Proof boundary

This run establishes confirmed-account password sign-in, live owner/admin invitation and audience behavior, persisted memory/profile writes, responsive browser rendering, and authenticated family/account deletion without objects. It does not establish public signup or email delivery, every viewer/selected-recipient browser combination, adversarial JWT handling, concurrent clients, network-failure recovery or cleanup retries.

Native developer-account availability remains unknown. The local environment had no Expo/EAS CLI, account-state directories, configured owner/project ID or Xcode marker; the Expo page in Chrome showed **Log In** rather than an authenticated account. Those observations do not establish whether the owner has developer accounts elsewhere. No enrollment, signing, native build or store submission occurred.

Current deployment, database and remaining release gates are maintained in [release.md](release.md).
