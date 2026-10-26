# Store submission draft

Owner review required. This copy has not been submitted to either store. Advertise only behavior accepted in the actual native builds; web deployment receipts do not authorize a native availability claim.

## Listing copy

App name: **Welyto**

Apple subtitle: **Your family's weekly memories**

Google short description: **Keep family stories and photos together, one week at a time.**

Full description draft:

> The little stories are the ones you want to keep.
>
> Welyto gives your family a place to save them together. Write about a moment, add a date and a photo, and choose who gets to see it.
>
> Make a weekly habit of remembering. Revisit the memories your family has shared this week, or search your collection by story, person, place or tag.
>
> Invite relatives into your family space. Give members room to contribute or invite someone with read-only access. Keep a memory private, share it with the family, or choose individual people and their editing access.
>
> Family owners and admins manage membership. Private memories stay limited to their chosen audience. You can archive your memories, transfer family ownership and delete your account from the app.
>
> An account and internet connection are required. Photos and stories are stored through the Welyto service; they are not end-to-end encrypted. People can keep copies of content they have already downloaded.

Suggested category: **Lifestyle**, subject to the publisher's final store classification. Do not select a Kids category merely because family members appear in memories.

## Submission data inventory

This table is an implementation inventory for the publisher's answers, not a pre-certified privacy label. Reconcile it with the actual binary, hosting logs, SDKs, platform permissions and all distributed versions. Apple requires app and third-party collection to be considered; Google includes off-device transmissions by SDKs. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)

| Data | Actual use to verify | Candidate store categories and purpose |
| --- | --- | --- |
| Email and display name | Sign-in, identification and invitations | Contact information/name/email; account management and app functionality; linked to the account |
| Auth user ID and family membership | Account and audience access | User identifiers; account management/security and app functionality; linked |
| Stories, titles, memory dates, tags and named people | The family's saved collection | Other user-generated content; app functionality; linked |
| Selected photos | Memory attachments in private storage; inspect whether embedded metadata is preserved | Photos/images; app functionality; linked; optional upload; assess any retained location metadata |
| User-entered place | A memory's descriptive place field | Assess location or user-content category using the exact current form; the app does not collect device GPS |
| Request IP addresses and provider logs | Hosting, authentication and operational security | Review actual provider handling and form definitions before selecting diagnostic/device/location fields; do not assert zero collection |
| Local search/filter state | Finding memories on the device | No stored server search-history feature in the initial app; inspect actual network/log behavior before declaring |

The intended initial app has no advertising, payment flow, behavioral analytics or cross-app tracking. A service-provider relationship and user-directed sharing may affect Google's specific "sharing" answers; answer from the current form's definitions and actual provider agreements rather than treating every transfer identically. There is no end-to-end encryption claim. Confirm HTTPS handling for the deployed APIs and the final native transport configuration before attesting to encryption in transit.

## Required owner-supplied material

- Publisher identity and a working private support/privacy contact; final publicly accessible privacy and web account-deletion URLs. A GitHub repository alone is not the account-deletion service.
- Store account/team IDs and registered identifiers. Keep private signing and submission credentials in the owner's credential service, never this repository.
- Authentic iPhone/iPad and Android screenshots for the supported form factors, using consented test data. Add actual screenshot files only after those builds run.
- A functioning reviewer account and exact invitation/deletion review steps in the stores' private review notes, with owner consent for any included data.
- Current age/content-rating and target-audience answers, supported regions, export-compliance answers and any required SDK privacy manifests. No age rating is assigned here.
- Final deletion/retention explanation matching `docs/privacy.md`, the deployed deletion functions and provider backup/log settings. Apple requires an in-app account-deletion path for account-creating apps; Google also requires an external web path. [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111)

Native acceptance, build artifacts, submission and public store URLs are tracked separately in [the native release guide](native-release.md).
