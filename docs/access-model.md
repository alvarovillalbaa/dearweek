# Dearweek persistence and access model

This document describes the source implementation. It does not establish deployed Auth, Storage, RLS, concurrency, email delivery, native-device, or store acceptance proof. The initial SQL is promoted into a CLI-created migration before application. Keep `private` out of the Data API's exposed schemas.

Dearweek is the current product name. The original Welyto migration, constraint/policy names and SQL fixture namespace remain unchanged; renaming the product does not create another database or alter its authorization contract.

## Ownership and audiences

The normalized tables are `profiles`, `families`, `family_members`, `invitations`, `memories`, `people`, `memory_people`, `memory_recipients`, and `photos`. Invitation hashes and pending-deletion markers live in non-exposed `private` tables. Foreign keys cascade dependent family/memory records; an owner profile cannot be deleted while it owns a family. A unique owner-role index and deferred constraint triggers require each surviving family to retain its designated owner membership.

Every application table has RLS and explicit grants. Anonymous clients receive no application-table or RPC access. Verified, non-anonymous accounts can read only authorized rows. Display-name insert/update is limited to the caller's own profile; the signup trigger seeds a bounded display name from editable signup metadata. That metadata never grants membership or permissions. All other application writes use the documented RPCs. No client receives the service key.

Authorization reads current `family_members` and Auth-account existence rather than JWT membership claims. Removing membership therefore revokes fresh table and authenticated original-photo requests. A deleted Auth identity also fails database authorization even if an old JWT has not expired. Already downloaded files, browser-held blobs, screenshots and other copies cannot be revoked.

| Role or audience | Source behavior |
| --- | --- |
| Owner | Invites, appoints admins, removes members, transfers ownership, explicitly deletes family. Must transfer or delete before deleting own account. |
| Admin | Invites members/viewers and removes members/viewers. Cannot appoint admins, remove another admin, or transfer ownership. |
| Member | Creates memories; can edit another selected memory only with an explicit edit grant. |
| Viewer | Reads authorized memories; cannot contribute or edit. Demotion clears their existing edit grants atomically. |
| Family memory | Visible to current members, including viewers. Only its author edits unless the audience changes to selected. |
| Private memory | Visible to its author while still a current member. Admin/owner status grants no additional read access. |
| Selected memory | Visible to its author and selected current members. Edit grants require a non-viewer role. Only the author changes recipients/audience or archives. |

Any non-owner can leave through `remove_member` targeting their own ID. Removal also deletes that member's audience grants and outstanding invitations for their current verified email or issued by them. A manager can deliberately issue a new invitation later. Accepting a second old invitation cannot silently reverse that removal. Existing authored family memories remain until their author deletes their account or the owner explicitly deletes the family.

`people` names are visible only when linked to a memory the caller can read, preventing a private memory's person names from leaking through a global family-name list. A save creates/reuses family-scoped people and replaces links atomically. The database never accepts cross-family person IDs from a client.

## Mutation and invitation boundaries

Public RPC functions are security invokers. Their privileged implementations live in `private`, use an empty fixed search path, qualify table/function references, and bind authorization to `auth.uid()`. Execution is revoked from `PUBLIC` and `anon` and granted only to the authenticated entry points and helpers required by policies. The Auth-profile and deferred-owner trigger functions execute for their trusted trigger events rather than accepting a client identity.

Mutations serialize the acting account with its deletion guard, then lock the family row. Memory changes and photo operations also lock the memory row. Membership changes, owner transfer, invitation acceptance, audience changes and recipient validation therefore share the family lock. Concurrent updates must recheck current access. Editors cannot change author or family, and an editor-supplied audience/recipient change fails the entire save. A failed save does not commit a partial memory, recipient set or person set.

Invitation tokens contain 32 random bytes encoded as hex. Only SHA-256 hashes are stored, in the private token table; the raw token is returned once. Invitations expire after seven days. Acceptance checks the email in `auth.users` with `email_confirmed_at`, not editable profile/JWT metadata, then consumes the invitation under lock. Existing membership is never promoted by accepting an invitation. The inviting person shares the link; the backend sends no invitation email. Email confirmation remains enabled.

Server limits: title 160 characters, story 20,000, place 200; up to 50 people names of 100 characters; up to 20 tags of 50 characters; up to 100 distinct selected recipients. A selected audience needs at least one current recipient. A memory holds at most 20 photo reservations, including pending uploads.

## Private original photos

The private `memory-photos` bucket accepts JPEG, PNG and WebP with an 8 MiB object limit. `reserve_photo` returns a `pending` row with a generated exact `family UUID/memory UUID/photo UUID.extension` path. The client uploads to that path without upsert. No public URL, signed URL, move, copy, replacement, resumable or S3 upload policy is provided. Authenticated Storage downloads use the current memory audience. Operation-aware policies exclude signing operations, so a client cannot mint a URL that outlives membership.

The upload policy requires the reserved path, pending state, matching uploader and current edit access. It checks MIME/size metadata when supplied; Storage's preliminary permission probe can omit final size. The bucket enforces its actual upload limit. `complete_photo` checks that the object exists in `storage.objects` and that its final MIME/byte size match the reservation before marking it ready. This checks object metadata, not image magic bytes or malware. Hosted upload/download behavior and the target Storage operation-helper version still need verification.

Photo removal requires the Storage API to succeed first. `remove_photo` then refuses to remove metadata while the corresponding object remains. Application SQL never deletes `storage.objects` rows to simulate deletion. A failed or cancelled upload remains pending so the client can report and retry/remove it. Non-ready objects are available only to their uploader through the normal authenticated read policy; another editor may need the uploader to clear a pending object. Owners can delete the entire family through the authenticated deletion path.

## Account and family deletion

`delete-account` accepts `POST {"confirm":true}`. `delete-family` accepts `POST {"family_id":"UUID","confirm":true}`. Both retain gateway JWT verification and explicitly call Auth `getUser` using the built-in `SUPABASE_URL` and a publishable key. The pure `supabase/functions/_shared/project.ts` module owns public fallback values shared with the client. Edge Functions may use its publishable key only when the built-in URL exactly matches its public project URL. An explicit `SUPABASE_PUBLISHABLE_KEY` runtime setting takes precedence; it must be a valid publishable key for that deployment, and missing/invalid configuration fails closed. No runtime publishable-key setting is needed for the matching default project. The client imports only this pure module, never the privileged deletion module. Neither function accepts a body `user_id`. Only after a verified request do they use the built-in server-only `SUPABASE_SERVICE_ROLE_KEY` for Storage cleanup and Auth Admin deletion. Errors and logs never echo provider responses, tokens, paths or secrets. Success is `{ok:true,deleted:true,scope:"account"|"family"}`.

The public settings module starts with empty connection values and `emailDeliveryVerified: false`. Signup, confirmation resend and password-reset email requests stay disabled until owner-configured SMTP and real delivery are verified; Supabase's [default SMTP](https://supabase.com/docs/guides/auth/auth-smtp) is limited to project-team addresses. Existing confirmed accounts can sign in independently of delivery readiness, and a real recovered session can update its password. Fixture account tests are not SMTP evidence, and email confirmation must remain enabled.

Additional authenticated RPCs support the Edge Functions:

| RPC | Contract |
| --- | --- |
| `begin_account_deletion()` | Rejects family owners; locks affected families and persists an account-deletion marker. |
| `begin_family_deletion(p_family_id uuid)` | Checks the current owner under the family lock and persists a family-deletion marker. |
| `deletion_photo_paths(p_family_id uuid default null,p_limit integer default 100)` | Returns at most 100 exact paths with existing Storage objects, authorized by the caller's pending marker. Null family selects their authored-memory photos and uploads; a family selects all its photos. |
| `finish_account_deletion()` | Requires its marker and no remaining relevant Storage objects; deletes authored memories, uploads, audience grants, memberships, current-email/issued invitations, and newly orphaned people linked to deleted memories. |
| `finish_family_deletion(p_family_id uuid)` | Requires the current owner and family marker and no remaining family Storage objects, then cascades the family and its dependent records. |

Begin guards lock families containing the account's memberships, authored memories or uploads, including former families. New writes and Storage uploads fail while a relevant marker is pending; account creation, invitation acceptance and incoming owner transfer cannot bypass the account marker. Upload policy checks take the same family/memory locks. A Storage request that began earlier must still pass its final policy check; the provider's handling of in-flight/failed upload bytes remains a hosted verification boundary.

The Edge cleanup loop removes at most 100 existing objects per Storage API call, with at most 20 batches and a 40-second loop budget per invocation. It queries the first remaining paths after each removal, so a retry resumes from objects still present. Before deleting rows it checks Storage again. Any failure retains the marker and remaining rows, blocks new content, and returns a retryable failure instead of claiming deletion. A large cleanup may require repeated authenticated requests. The pending family owner can still read that family's metadata and their own owner-membership row after a reload, so the deletion action remains discoverable; family content remains hidden and writes remain blocked. A verified caller can still read their own profile while account deletion is pending. There is no automatic cancellation/unfreeze UI; retry deletion to finish.

Account deletion preserves the profile and marker until Auth Admin deletion succeeds. If photo/data cleanup succeeds but Auth deletion fails, the verified account can retry; other app access remains blocked. Deleting Auth cascades the profile and account marker. An account owner must explicitly delete each owned family or transfer ownership first. Family deletion removes everyone's memories and photos in that family; it does not delete the members' Auth accounts or their other families. People still linked to surviving memories are retained. New invitations deliberately created by others after deletion, backups, provider logs and hosting retention are separate from this application-row path.

Before release, verify these flows with multiple real verified accounts, concurrent writes, removed membership, failed cleanup and retries. Confirm bucket versioning stays disabled and review provider backup/log retention. These source controls are not an App Store/Google Play compliance claim; owner-reviewed store disclosures and actual delivery, deletion and hosting evidence remain required.

## Current implementation references

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database functions](https://supabase.com/docs/guides/database/functions).
- [Storage access policies](https://supabase.com/docs/guides/storage/security/access-control), [operation helpers](https://supabase.com/docs/guides/storage/schema/helper-functions), and [Storage schema: API-only object changes](https://supabase.com/docs/guides/storage/schema/design).
- [Storage deletion API](https://supabase.com/docs/guides/storage/management/delete-objects), [Auth Admin user deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), and [Edge authentication headers](https://supabase.com/docs/guides/functions/auth-headers).

Documentation searched/read on 2026-10-26. Current Storage uploader source was inspected to account for preliminary upload probes and final authorization; the hosted provider version remains unverified.
