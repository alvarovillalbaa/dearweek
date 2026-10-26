# Free Supabase capacity proposal

Status: explicitly approved by the owner on 26 October 2026, including focused regression checks. The additive schema installation is complete; Auth redirect configuration, app cutover and retirement checks are in progress. Neither original project has been paused. This document records the reviewed arrangement; actual evidence belongs to the owning app receipts.

The owner has ruled out a paid Supabase plan. Supabase currently allows this account two active free projects across all organizations where it is owner/admin; a third project creation failed even after the tool quoted `$0/month`. [Current billing contract](https://supabase.com/docs/guides/platform/billing-on-supabase#free-plan).

## Concrete free arrangement

Keep Still's existing project (`wosqlzijmyiemueoittw`) running, add Kickoff's disjoint schema to it, and switch Kickoff to that backend. Both public apps stay deployed in their own repositories and Vercel projects. After verified cutover, pause only the retired Kickoff backend (`lucbdtdsofnybynjpdbp`), then create a separate Welyto project in the freed free slot. Welyto keeps its own Auth identity space, so its account-deletion flow cannot delete Still or Kickoff accounts.

Read-only live inspection on 26 October found zero Auth accounts and zero app records in both projects. Still has `public.documents`, `public.mcp_tokens`, `public.save_document`, `public.mcp_dispatch` and `still_private` helpers. Kickoff's tables, public RPCs and `private` helpers do not collide with them. Empty counts establish a current snapshot, not permission to move or retire a resource; all counts and consumers must be rechecked immediately before any cutover.

## Approval-relevant behavior

Still and Kickoff would share one Supabase account/password namespace, password resets, SMTP configuration, email templates and usage limits. Their browser sessions remain local to each app. Kickoff's current default global logout must become local logout so it cannot revoke Still sessions. Its callback URL must be added to Still's existing Auth allowlist without replacing Still's Site URL or redirects. [Sign-out scopes](https://supabase.com/docs/guides/auth/signout), [redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

Email confirmation must stay enabled. Still's README documents an owner-approved but deferred immediate-signup/autoconfirm policy; that policy is incompatible with Kickoff's verified-account requirement on a shared Auth service. This proposal would supersede that future Still policy with confirmed-email signup, while preserving its current signup gate until actual email delivery is ready. It does not enable autoconfirm, phone OTP, a paid plan or SMTP credentials.

Kickoff's operations guide currently says, “No reutilices la base de datos de otra aplicación.” The user-supplied AGENTS.md §14 also requires approval before Auth/security and infrastructure changes. Those explicit contracts are why this concrete arrangement needs an owner decision before applying it.

## Execution and acceptance after approval

1. Recheck both projects' Auth/data/dependency state; capture bounded schema, grants and Auth-setting snapshots. Stop if new accounts/data or incompatible consumers appear.
2. Apply the reviewed canonical [Kickoff schema](https://github.com/alvarovillalbaa/kickoff/blob/main/supabase/schema.sql) to Still's project. Preserve all Still tables, RLS/grants and `still_private` functions. Keep both helper schemas unexposed.
3. Add Kickoff's production callback allowlist entry; preserve current Still Auth settings and confirmation. Change only Kickoff's public URL/key binding and logout scope, then publish its source and hosted build.
4. Run owner-approved focused checks for Kickoff's catalog/ownership/bookings/invitations and Still's editor/document/MCP isolation, with disposable test fixtures that are removed. Explicitly separate synthetic access proof from real SMTP delivery proof. Update the closest owner docs in both repositories.
5. Verify that the old Kickoff backend has no remaining data/accounts/active consumers, then pause that retired backend. Create Welyto in the freed slot at the already accepted free cost, deploy its migration/functions, configure its public client and perform its approved access/photo/deletion checks.

No migration is applied and no service is paused before this approval. Zero-data fixtures are never treated as real product inventory.

## Rollback boundary

Before pausing the old Kickoff project, restoring Kickoff's prior public configuration/deployment returns it to the still-running old backend. Additive imported objects should remain until cleanup is separately reviewed. If the target acquired new accounts/data, reconcile that state before rollback.

After the old backend is paused and Welyto fills the second slot, resuming old Kickoff would exceed the free-project limit. Recovery would require another explicitly authorized capacity decision. The old project is retained as paused, not deleted; that distinction does not make post-cutover rollback instant.
