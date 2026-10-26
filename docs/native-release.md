# Native release

Dearweek's source targets iOS, Android and web. A successful Vercel web export proves neither native compilation nor store publication. Record actual build IDs, artifact hashes, device results and store URLs in `docs/results/` as those steps happen.

The native identifiers are `com.alvarovillalbaa.dearweek`. These identifiers have not been registered. Confirm their availability in the owner's store accounts before registration; do not choose a replacement identifier without the owner choosing it.

## Accounts and environment

The owner explicitly confirmed that no Expo account exists. No Expo owner or EAS project ID is linked in this repository. An owner-controlled Expo account/project is required before using EAS; account creation has not been performed. Apple Developer team, App Store Connect and Google Play Console ownership remain to be established. Store builds require the appropriate signing credentials. [Expo's build setup](https://docs.expo.dev/build/setup/) distinguishes installable previews from store builds and describes these account requirements.

Set the same reviewed Supabase URL and publishable key in the EAS environment used by each profile. These client values are intentionally public; service-role keys, SMTP passwords, Apple keys and Google service-account JSON never belong in `EXPO_PUBLIC_*`, app configuration or Git. Verify the Auth redirect allowlist includes the production web origin and `dearweek://auth/callback` before building. Keep email confirmation enabled and complete production SMTP delivery checks.

After owner authentication, use the installed EAS CLI's help to verify its current commands. Link the owner-selected existing project, or create one under the owner's selected Expo account; do not insert a fabricated EAS project ID. `eas project:init` and `eas build:configure --platform all` are the documented setup commands. Review their configuration changes. [EAS CLI reference](https://docs.expo.dev/eas/cli/)

## Preview and production artifacts

With the repository's preview profile configured for an Android APK and `ios.simulator: true`, the operator can build and install previews:

```sh
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

An APK runs on an Android device or emulator. An iOS simulator archive is separate from a signed device/store build and can be built without an Apple Developer membership. [APK guide](https://docs.expo.dev/build-reference/apk/), [iOS simulator guide](https://docs.expo.dev/build-reference/simulators/)

After preview acceptance, build signed store artifacts:

```sh
eas build --platform android --profile production
eas build --platform ios --profile production
```

The production Android artifact must be an AAB; the iOS artifact is for App Store Connect. Review version/build-number increments and credential ownership before each build. [EAS profile reference](https://docs.expo.dev/build/eas-json/), [production builds](https://docs.expo.dev/deploy/build-project/)

Submission is a separate, owner-authorized action. Using a verified build ID rather than an ambiguous latest artifact, the documented command is `eas build:submit --platform android --id BUILD_ID` or the corresponding iOS command. First-time Play setup can require a manual upload. Uploading to TestFlight does not release an app to the App Store; metadata, screenshots, build selection and App Review still follow. [Store submission guide](https://docs.expo.dev/deploy/submit-to-app-stores/)

## Acceptance before submission

- On both native platforms, verify cold launch, keyboard avoidance, safe areas, accessible labels/text size, narrow screens, background/foreground session refresh, logout and subsequent login.
- With distinct real test accounts, exercise signup confirmation, password recovery through a deep link, family creation, an email-bound invitation, every membership role, owner transfer and loss of access after removal.
- Save and reload dated stories with people/tags; verify family, private and selected audiences, edit grants, search, archive/restore and the family's timezone week boundary. Ensure another family cannot read or mutate them.
- Pick supported photos through the system library, cancel, deny any requested permission, upload/reload, simulate a failure and retry, and verify a removed member cannot download the original. Inspect the actual generated native permissions and upload behavior; a web picker check is insufficient.
- On native and web, delete a disposable account and verify authored database content, uploaded objects, membership and Auth removal. Exercise owner transfer or explicit family deletion first. Verify errors leave a clear retry path rather than a false success message.
- Verify `/privacy` and `/delete-account` on the final public web origin without native installation. The latter must provide a working web sign-in and deletion path, not send the person back to a download page. [Google's deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)

Use consented test content and accounts. Do not put real relatives' photos in a public repository, screenshot bundle or store review note.

## Owner release inputs still required

The publisher must confirm account/team ownership, identifier registration, signing custody and any build/service charges. The supplied support/privacy contact is [alvaro.villalbaperez@icloud.com](mailto:alvaro.villalbaperez@icloud.com); verify support-form delivery separately. Supply the publisher's identity, final policy URL, deletion URL, supported countries and intended audience. The current web origin is `https://dearweek.vercel.app`; the native return URL is `dearweek://auth/callback`. Review the draft [store listing and data declarations](store-listing.md) against the final native binary and provider configuration. Capture screenshots from real builds with consented content and provide store reviewers a functioning test account through the store's private review channel.

Complete Apple privacy answers, age-rating questions, export-compliance answers and any required SDK privacy manifests for the actual binary. The current Apple age rating comes from its questionnaire; no fixed rating is assigned by this source repository. [Apple age ratings](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)

Complete Google Data safety, account deletion, target audience and content-rating forms. If the selected personal Play account was created after 13 November 2023, current policy requires a closed test with at least 12 opted-in testers continuously for 14 days before applying for production access. Verify the selected account's eligibility in Play Console. [Google personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465)

The owner chooses whether the product admits child accounts. Adult-managed family memories do not establish child-directed privacy compliance or a Kids-category release. Review the final audience and required controls before making either claim.
