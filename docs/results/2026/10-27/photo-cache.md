# Photo cache invalidation and overlapping loads

Status: client repair published, nine mocked cases passed, hosted typecheck/export and public delivery verified. Real picker/upload/Storage acceptance remains open.

The approved Welyto/Dearweek access/photo/deletion scope remains in force. Review of [the earlier runtime receipt](../10-26/runtime-checks.md#photo-check-blocked-by-browser-file-access) and [current release receipt](../10-26/dearweek-release.md#limits-and-final-follow-up) confirmed that a supported chooser retry had already failed after the owner enabled file-URL access, followed by another refusal from a freshly attached tab. No new browser state change was supplied. This turn did not repeat that denied operation, open a tab, create an account, upload a photo or change permissions. The browser connection was checked only for an existing handle; no page or profile state was inspected.

## Reproduced client defects

Baseline [`49c04be6b210a37bf2389b7ec62b313306e8173f`](https://github.com/alvarovillalbaa/dearweek/commit/49c04be6b210a37bf2389b7ec62b313306e8173f) captured the cache generation after awaiting `getUser()`. A load started in an old family view could therefore continue after `clearPhotoCache()`, take the new generation and start a new download. An old forced reload could also revoke a valid URL populated by the new view before that old Auth lookup completed.

Two same-key downloads could each create a blob URL and overwrite the single cache entry. Only the last URL remained tracked for later revocation. The earlier returned URL could outlive the cache clear. This is a client resource/lifecycle defect, not evidence of a server authorization bypass.

`loadPhoto` now captures the generation before its first await and checks it immediately after Auth, before force eviction or cache access. Its existing final generation check still rejects/revokes stale download results. If another same-key load populated the current cache while bytes were downloading, the late load revokes its own redundant blob URL and returns the tracked URL. The check/set contains no await.

Auth calls, RLS, membership rules, upload/removal/deletion transport, cache keys and public API shape are unchanged. This does not revoke copies a person already downloaded or change the server access contract.

## Focused proof

The new [Node cases](../../../../tests/unit/photo-cache.test.mjs) transpile and execute the actual `src/lib/api.ts` in an isolated test context. Every provider/platform import is replaced with an authored stub; unexpected imports, fetches and platform/mutation calls throw. Auth and download promises are controlled in memory, with at most two overlapping loads. URL creation/revocation is observed through a fixture implementation. No implementation helper is copied into the assertions.

Node **24.21.0**, using an existing read-only TypeScript **5.9.3** compiler, ran the same nine cases before and after the production change. No dependency was installed or modified. The declared app compiler remains TypeScript 6.0.3; transpilation is not its typecheck or an Expo/native build.

| Source | Pass | Fail | Result |
| --- | ---: | ---: | --- |
| Original module, before the repair | 5 | 4 | Failed Auth-wait invalidation, stale force isolation, and both overlapping-download completion orders. |
| Repaired module, same assertions | 9 | 0 | No skips, retries or cancelled cases. |

The passing cases retain normal cache reuse with an Auth recheck, pending/signed-out rejection, stale download cleanup, Auth-error denial of cached results and current-view force-refresh errors. New schedules cover invalidation during Auth, stale forced reloads and both overlapping-download orders. Independent source review confirmed the schedules and scoped remedy before editing; final source/harness review found no blocker. The nine runtime imports are mocked, process environment is empty, and unexpected fetches/platform calls throw. These cases assert URI ownership, not deduplicated network requests; both overlapping downloads still occur.

Owned-file whitespace/newlines, eleven local Markdown targets and `git diff --check` passed. The dependency manifest/lock, `App.tsx`, Auth settings module, migrations and deletion functions compare unchanged against the baseline. No local full TypeScript check or app build ran.

With the repository's locked dependencies present, run:

```sh
node --test tests/unit/photo-cache.test.mjs
```

`DEARWEEK_TYPESCRIPT_PATH` may explicitly select an already available compatible compiler when a dependency install is unavailable. `DEARWEEK_PHOTO_API_SOURCE` supports a task-owned baseline snapshot for regression sensitivity. The loader mocks the same platform/provider boundary for that source. Do not substitute this for the app's real compiler, real SDK, native picker, JPEG conversion, Auth session, Storage round trip or UI integration.

No browser interaction, live Auth/Storage check, account or production row/object mutation, model call, schema/Auth/config/dependency/CI change, local app build or native capture occurred. Photo chooser, real upload/completion/download/removal, removed-member fresh Storage denial and deletion with actual photo objects remain unverified. Earlier PostgreSQL and object-free deletion receipts keep their original scope.

## Publication

Source [`5b9a864d60b8daaf3bbbd45b3f330a217da82e5c`](https://github.com/alvarovillalbaa/dearweek/commit/5b9a864d60b8daaf3bbbd45b3f330a217da82e5c) was published to personal `main` and matched the remote readback. Production deployment `dpl_GzxNmsEk21jgM6A28V6HJWdDwjgb` reached `READY` at that exact SHA with the Dearweek canonical alias. Build logs show the configured `tsc --noEmit && expo export --platform web && node scripts/finalize-web.mjs` completed; the unchanged lock declares TypeScript 6.0.3 and Expo 58.0.19. This is hosted build/typecheck proof, independent of the mocked test runner's TypeScript 5.9.3 transpilation.

A connected HTTP fetch of [the app](https://dearweek.vercel.app/) returned 200 and referenced `_expo/static/js/web/index-dfe35b776328b3efe369364e21ea2e0d.js`, matching the emitted asset in those build logs. No sign-in, browser interaction or private-photo workflow was performed for that delivery check. Subsequent documentation-only commits retain these product/test bytes and do not expand acceptance.
