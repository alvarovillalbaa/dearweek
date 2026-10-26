# Public browser checks — 26 October 2026

The owner explicitly approved focused Welyto desktop/mobile browser checks and targeted backend checks using disposable fixtures. This receipt covers only actual browser rendering and public navigation at [welyto.vercel.app](https://welyto.vercel.app). Supabase provisioning is unavailable because of the active free-project cap, so no account, email, memory, photo, invitation or deletion operation was submitted.

Chrome was selected by the supported browser runtime for this URL. All actions used a new Welyto-owned tab; no existing user or Agent Library tab was claimed. Browser viewport overrides were used for the two requested sizes and reset after checking. The tab was returned to the `/` landing. No dependencies, model calls, native simulator, file chooser or upload were used.

## Observed public behavior

| Check | Observed result |
| --- | --- |
| Landing, 1440 × 900 | Welyto renders its service-unavailable message and Privacy/Account deletion controls. Document and body widths equal 1440; neither control overflows. |
| Landing, 390 × 844 | Heading, setup message and both controls fit. Document/body widths equal 390. Both controls are 44 pixels high. |
| Desktop keyboard | Tab focuses Privacy, Enter opens `/privacy`, and Tab/Enter activates Back to Welyto. From the landing, the second Tab focuses Account deletion and Enter opens `/delete-account`. |
| Direct `/privacy`, desktop/mobile | The app renders the privacy heading and explicit setup-unavailable notice. Widths match the respective viewport. At 390 pixels the internal content scrolls; the Back control is reachable, 44 pixels high and returns to the landing. |
| Direct `/delete-account`, desktop/mobile | Reload/direct navigation renders the deletion information. The sign-in action is visibly disabled while the backend is absent. Keyboard Tab skips it and focuses Back to Welyto. Widths match the viewport. |
| `/auth/callback` without tokens, 390 × 844 | The app renders the unavailable-service landing, without claiming authentication or crashing. Document width equals 390. No console error was captured for that navigation. No real token was supplied. |

Screenshots were visually inspected at the key desktop/mobile landing states. These checks exercise the public setup state; the authenticated app screens are unavailable on this deployment and were not represented with fake family data.

## Browser history defect

The first pass found a reproducible mismatch: landing → Account deletion → reload `/delete-account` → browser Back changed the URL to `/`, while the heading still read “Delete your Welyto account.” A fresh accessibility tree and a DOM-backed heading read confirmed the stale page state. [Before-fix screenshot](browser-back-before-fix.jpg) captures the visible content; the URL/content mismatch is established by the browser observations above.

The implementation owner confirmed production deployment `dpl_HKhzyZ57objLD8wxf7eawo2A7cJG` reached `READY` at exact source commit `cc04b1c80caeab8a99e6115c0b58963a9aaf4497`, which clears public-page state for other paths and listens for browser history changes. The browser then loaded the public origin again before rechecking the fix.

| Viewport | Route | Reload | Browser Back | Browser Forward |
| --- | --- | --- | --- | --- |
| 1440 × 900 | `/privacy` | Privacy heading at `/privacy` | Landing heading at `/` | Privacy heading at `/privacy` |
| 1440 × 900 | `/delete-account` | Deletion heading at `/delete-account` | Landing heading at `/` | Deletion heading at `/delete-account` |
| 390 × 844 | `/privacy` | Privacy heading at `/privacy` | Landing heading at `/` | Privacy heading at `/privacy` |
| 390 × 844 | `/delete-account` | Deletion heading at `/delete-account` | Landing heading at `/` | Deletion heading at `/delete-account` |

All twelve URL/heading observations matched, with document width equal to the viewport throughout. [Desktop Back result](history-back-desktop.jpg) and [mobile Back result](history-back-mobile.jpg) capture the restored landing. Final public navigation returned no captured page console errors.

During a scrolled mobile-view sequence, one automated click focused Back without navigating; the following Account deletion locator consequently timed out. The current page was inspected before continuing, and Enter activated the focused Back control and restored the landing. History checks then completed as above. This is an observed automation limitation; physical mobile pointer/touch behavior was not established.

## Captures

- [Desktop landing](landing-desktop.jpg), [mobile landing](landing-mobile.jpg).
- [Desktop privacy](privacy-desktop.jpg), [mobile privacy](privacy-mobile.jpg), [mobile privacy after scrolling](privacy-mobile-bottom.jpg).
- [Desktop deletion information](delete-account-desktop.jpg), [mobile deletion information](delete-account-mobile.jpg).
- [Token-free callback](callback-mobile.jpg).

These are webpage screenshots; they are not native device captures. A full-page screenshot of the React Native web app can still show only its viewport because the content uses an internal scrolling container; the separate scrolled privacy capture demonstrates its return control.

## Proof boundary

No backend tests ran in this browser task. SQL execution, Edge Function deployment/runtime, Auth delivery/recovery, authenticated roles and cross-family isolation, photo round trips, deletion completion, native compilation/device behavior and App Store/Google Play publication remain unverified. Current publication IDs and provider blockers belong to [the release receipt](release.md).
