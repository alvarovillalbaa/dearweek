# Preserve edits during photo retry

Status: frontend repair and focused mocked checks complete locally; source publication and hosted build/delivery readback pending below. Actual photo-picker/Storage, public email and native/store acceptance remain open.

## Defect and remedy

Baseline: [a42c8ada9301dba24f8359e5e4a1ffa8e106f35f](https://github.com/alvarovillalbaa/dearweek/commit/a42c8ada9301dba24f8359e5e4a1ffa8e106f35f), editor blob `f63540ffefdb182d03552d8e4b702cac2d631b58`. The [product contract](../../../spec.md) requires failed saves to retain drafts and photo failures to remain visible/retryable.

After the initial story saved but a photo failed, a user could edit the story/audience and click **Retry unfinished photos**. That path deliberately skipped `saveMemory`, uploaded the photos and then closed the editor, discarding the later unsaved edits. Audience handlers also left the previous saved notice visible; the initial partial-upload error itself contained stale “story is saved” text.

[MemoryEditor](../../../../src/components/MemoryEditor.tsx) now keeps the editor open when a photo-only retry began with unsaved changes. A successful retry explains that the photos uploaded while story/audience edits still need **Save changes**. A failed retry retains the edits and shows truthful failure copy. Photo-only retry does not silently save text or audience changes. A later explicit save uses the existing memory ID and skips completed photos; clean photo-only retries retain their close-on-success behavior.

All text/audience changes clear stale general notices and the saved flag. Individual failed-photo states, errors and retry controls remain intact. An outstanding picker blocks submission/retry/close, preventing the editor from disappearing while a selection is still pending. An already-visible discard confirmation is also disabled and defensively guarded while a picker, save or parent refresh is pending. The existing parent refresh is awaited before a successful close; no parent save, transport, authorization or persistence contract changed.

## Focused evidence

The new [eleven Node cases](../../../../tests/unit/memory-editor.test.mjs) transpile and execute the actual TSX component function and returned handlers. Authored hook cells preserve state between controlled renders; native/UI/API imports are mocked, and unexpected imports/network calls throw. Assertions drive current field/button/audience props and inspect the resulting draft, API calls, notices and close confirmation. The harness does not copy the editor's submission logic.

The final unchanged harness ran against an immutable Git baseline snapshot and the repaired module on Node **24.21.0** with existing read-only TypeScript **5.9.3**. No dependency was installed or modified. The temporary baseline source was removed after the run.

| Actual module | Cases | Passed | Failed |
| --- | ---: | ---: | ---: |
| Baseline editor | 11 | 3 | 8 |
| Repaired editor | 11 | 11 | 0 |
| Existing photo-cache module | 9 | 9 | 0 |

There were no skips, retries or assertions removed. The editor cases cover dirty-story retention, explicit later save/refresh, visibility/recipient/edit-grant changes, clean retries, another upload failure, validation/save failure, a pending picker and an already-visible discard confirmation. Controlled promises also keep retry/refresh boundaries open while checking busy/read-only state. An intermediate repaired run exposed the stale success text inside the existing error notice; the production notice invalidation was corrected without weakening the final assertions. Independent source review then identified the existing confirmation callback bypass; a new eleventh case covers that sequence, while the first ten cases remained byte-identical. The final harness SHA-256 is `5c1dea0b98f33284e3ad20649bc7b92b243c1faabb879605693b4c9531b78d4a`.

```sh
node --test tests/unit/memory-editor.test.mjs tests/unit/photo-cache.test.mjs
```

`DEARWEEK_TYPESCRIPT_PATH` can select a compatible existing compiler; `DEARWEEK_MEMORY_EDITOR_SOURCE` selects a baseline source snapshot for sensitivity checks. Neither variable changes production code. The declared app compiler is TypeScript 6.0.3; this mocked transpilation is not its typecheck or an Expo/native build.

## Proof limits

This is actual-component handler/state proof with mocked React/platform/API boundaries. It does not execute React reconciliation/batching, render DOM/native UI, invoke the real picker, upload an object, or prove Auth/Storage transport. No account, backend row/object, provider configuration, model, schema, Auth policy, dependency or CI change occurred. The blocked chooser was not retried or bypassed. Local installs/builds remain blocked by the Storage Guard reserve.

Independent source review confirmed the dirty-retry behavior, parent integration and final confirmation guard; no remaining scoped must-fix was found. All four owned text files passed whitespace/newline checks, fourteen local Markdown targets resolved, and `git diff --check` passed. The dependency manifest/lock, parent App, client API and Supabase tree compare unchanged against the baseline. Immutable source/hosted release readbacks are recorded below after completion. Existing [photo-cache](photo-cache.md) and [Dearweek release](../10-26/dearweek-release.md) receipts retain their proof boundaries. The full multi-project goal remains active.

## Publication

Pending source commit and production deployment readback at the time this section was authored.
