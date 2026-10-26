# Welyto

A little closer, every week. Welyto gives families a private place to collect memories, people, places and photos, with an audience chosen for each story.

[Web app](https://welyto.vercel.app) · [Source](https://github.com/alvarovillalbaa/welyto)

The web export is published. The owner approved keeping Supabase free by consolidating Still and Kickoff, then using the freed slot for Welyto's isolated backend. Until that verified retirement and provisioning finish, account and memory saving services remain unavailable. Authenticated acceptance, verified email delivery and native store release remain open; see the [release evidence](docs/results/2026/10-26/release.md).

This repository contains one Expo application for iOS, Android and web, plus a Supabase PostgreSQL/Auth/Storage backend. It implements the [Welyto brief](https://app.notion.com/p/3fea1ee8bd06804bbfc1db4d900bbdd5); [the product contract](docs/spec.md) distinguishes its four source requirements from implementation choices.

## Development

Use Node 24.3 or later in the 24.x line. Run the workspace Storage Guard before a local installation or build; keep the 30 GiB reserve.

1. Set the public project's URL and publishable key in `supabase/functions/_shared/project.ts`, or copy `.env.example` to `.env` for public client overrides. The shared module contains only public values; its connection defaults remain empty until the intended project is created. Native invitation links use its web URL when no override is set. No service-role key belongs in this app or an `EXPO_PUBLIC_` variable.
2. Install from the committed lock with `npm ci`.
3. Run `npm run start`, `npm run ios`, `npm run android`, or `npm run web`. Native launch requires an available device/simulator or Expo Go compatible with SDK 58.
4. `npm run build:web` checks the app contract and exports a static web app to `dist/`. Vercel uses the same command; there is no separate fake web implementation.

## Backend and access

The initial migration in `supabase/migrations/` is the canonical schema. [Access rules](docs/access-model.md) describe live membership, invitation hashing, per-memory recipients, photo authorization and deletion. Apply migrations only to the intended Welyto project after inspecting it; never apply them to another app's database.

Deploy `supabase/functions/delete-account` and `supabase/functions/delete-family` to that project. The functions explicitly validate the caller's Auth token and use server-owned administrative credentials only for the guarded cleanup. They use the shared public publishable key only when the built-in `SUPABASE_URL` exactly matches that module's URL; other projects require an explicit matching `SUPABASE_PUBLISHABLE_KEY` runtime setting. The built-in service-role key remains server-only, and the client imports only the pure public settings module.

Keep email confirmation enabled and configure the web/native Auth redirects. Supabase's [default email service](https://supabase.com/docs/guides/auth/auth-smtp) sends only to project-team addresses and is not public delivery readiness. `emailDeliveryVerified` stays false until owner-supplied SMTP and real confirmation/recovery delivery are verified. While false, signup, resend and password-reset email actions are disabled without sending requests; existing confirmed accounts can sign in, and an actual recovered session can still update its password. Confirmed test fixtures do not justify enabling this flag.

Owners/admins create email-bound invitation links and share them manually. Members can contribute; viewers can read memories shared with them. Admin access does not reveal private memories. Use a memory's audience picker to share with the family, keep it private, or choose recipients and edit grants.

## Release

[Native release instructions](docs/native-release.md), [store copy](docs/store-listing.md), and [privacy information](docs/privacy.md) accompany the app. A Vercel web deployment is separate from a signed iOS/Android binary and a store release. Signing accounts, final privacy contact, real email delivery and store review must be evidenced before declaring the native release complete.

Publication and verification receipts belong in `docs/results/`. Focused source checks do not establish device behavior or authenticated production acceptance.
