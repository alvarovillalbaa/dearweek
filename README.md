# Dearweek

A little closer, every week. Dearweek gives families a private place to collect memories, people, places and photos, with an audience chosen for each story.

[Web app](https://dearweek.vercel.app) · [Source](https://github.com/alvarovillalbaa/dearweek)

The connected web app is published with its isolated free Supabase backend. The 37-group database pass and earlier owner/admin checks remain recorded; new Dearweek checks verified onboarding/contact routing, mobile family names, audience labels/search, and version 2 family/account deletion without uploaded photos. All runtime fixtures were removed through the app. Photo checks remain blocked by browser file access; email delivery and native store releases remain open. See the [current Dearweek release receipt](docs/results/2026/10-26/dearweek-release.md).

A [photo-cache repair](docs/results/2026/10-27/photo-cache.md) prevents old loads from changing a refreshed view's cache and keeps overlapping blob URLs tracked for cleanup. Nine mocked client regressions pass; they do not close the browser chooser or real Storage acceptance gaps.

This repository contains one Expo application for iOS, Android and web, plus a Supabase PostgreSQL/Auth/Storage backend. It implements the [original Welyto brief](https://app.notion.com/p/3fea1ee8bd06804bbfc1db4d900bbdd5). The owner requested a new name on 26 October 2026 and delegated the choice: Dearweek. [The product contract](docs/spec.md) distinguishes its four source requirements from implementation choices. Historical receipts retain the original name; the Dearweek web cutover is verified and native identifier registration remains open.

## Development

Use Node 24.3 or later in the 24.x line. Run the workspace Storage Guard before a local installation or build; keep the 30 GiB reserve.

1. Public defaults in `supabase/functions/_shared/project.ts` point to the dedicated Dearweek project `faftywddybmgamvseibe`. Copy `.env.example` to `.env` and override both the URL and publishable key with a separate development project before writing development data. Native invitation links use the shared module's web URL when no override is set. No service-role key belongs in this app or an `EXPO_PUBLIC_` variable.
2. Install from the committed lock with `npm ci`.
3. Run `npm run start`, `npm run ios`, `npm run android`, or `npm run web`. Native launch requires an available device/simulator or Expo Go compatible with SDK 58.
4. `npm run build:web` checks the app contract and exports a static web app to `dist/`. Vercel uses the same command; there is no separate fake web implementation.

## Backend and access

The applied [initial migration](supabase/migrations/20261026193912_initial_family_memories.sql) is the canonical schema for Dearweek's dedicated project in Clous, `eu-central-1`. It enables RLS on all nine public and three private application tables and configures the private `memory-photos` bucket for JPEG, PNG and WebP objects up to 8 MiB. [Access rules](docs/access-model.md) describe membership, invitation hashing, per-memory recipients, photo authorization and deletion. Future migrations require inspection and must target Dearweek's project, never another app's database.

`delete-account` and `delete-family` are deployed as active version 2 functions with gateway JWT verification enabled. Authenticated deletion through the app passed for accounts/families without Storage objects; actual photo cleanup and failure/retry behavior remain unverified. The functions explicitly validate the caller's Auth token and use server-owned administrative credentials only for guarded cleanup. They use the shared public publishable key only when the built-in `SUPABASE_URL` exactly matches that module's URL; other projects require an explicit matching `SUPABASE_PUBLISHABLE_KEY` runtime setting. The built-in service-role key remains server-only, and the client imports only the pure public settings module.

Email confirmation is enabled, anonymous sign-ins are disabled, and the production/native Auth return URLs were saved and checked after reload. Supabase's [default email service](https://supabase.com/docs/guides/auth/auth-smtp) sends only to project-team addresses and is not public delivery readiness. `emailDeliveryVerified` stays false until owner-supplied SMTP and real confirmation/recovery delivery are verified. While false, signup, resend and password-reset email actions are disabled without sending requests; existing confirmed accounts can sign in, and an actual recovered session can still update its password. Confirmed test fixtures do not justify enabling this flag.

Owners/admins create email-bound invitation links and share them manually. Members can contribute; viewers can read memories shared with them. Admin access does not reveal private memories. Use a memory's audience picker to share with the family, keep it private, or choose recipients and edit grants.

## Release

[Native release instructions](docs/native-release.md), [store copy](docs/store-listing.md), and [privacy information](docs/privacy.md) accompany the app. A Vercel web deployment is separate from a signed iOS/Android binary and a store release. The owner confirmed that no Expo account exists, and the Dearweek native identifiers have not been registered. Signing accounts, real email delivery and store review must be evidenced before declaring the native release complete.

Support and privacy contact: [alvaro.villalbaperez@icloud.com](mailto:alvaro.villalbaperez@icloud.com). The contact form prepares a draft for review/send in the user's email app; it does not send or persist the message. Its routing and validation were checked, while mail-client handoff and message delivery remain unverified. The recipient address is not SMTP configuration for account emails.

Publication and verification receipts belong in `docs/results/`. Focused source checks do not establish device behavior or authenticated production acceptance.
