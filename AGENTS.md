# Welyto

Private family memories for iOS, Android, and web. Product intent: the four bullets in the Welyto Notion brief linked in `docs/spec.md`.

- Preserve the native iOS and Android scope. A web deployment does not establish App Store or Google Play release.
- `docs/spec.md` owns product scope; `src/types.ts` owns the client contract; `supabase/` owns persistence and access rules. Never replace real persistence with sample family records.
- Use Expo SDK 58 and its compatible packages. Keep the dependency lockfile. No dependency install or local build after a failed Storage Guard preflight.
- Clients use only the Supabase URL and publishable key. Enable RLS on every exposed table. Membership is checked in the database on each operation; user-editable metadata never grants access.
- Owners/admins manage membership; private and selected memories still require audience access. A removed member immediately loses database and original-photo access. Do not claim that previously downloaded photos can be revoked.
- Keep memory mutations atomic through the documented RPC contract. Photo upload failures must remain visible and retryable. Never report a failed write as saved.
- Use `apply_patch` for manual edits. Preserve unrelated work. No CI workflows, plan changes, SMTP shortcuts, native signing or store submission without the appropriate owner authority.
- Use targeted source checks and `git diff --check`. Backend tests and browser checks need explicit user approval; the active goal authorizes GitHub publication and remote Vercel builds.
- Record checks and publication receipts in `docs/results/`. Keep source, hosted runtime, authenticated access tests, native binaries, and store publication proof distinct.
