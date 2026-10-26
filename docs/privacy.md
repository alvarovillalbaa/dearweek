# Dearweek privacy information

Updated 26 October 2026. This describes the initial implementation contract. Support and privacy contact: [alvaro.villalbaperez@icloud.com](mailto:alvaro.villalbaperez@icloud.com). The publisher must review the deployed service settings and support-form delivery before general distribution; this file alone is not a completed store privacy submission.

## Information used by Dearweek

Dearweek uses an email address, an account identifier and a display name to provide sign-in and family membership. Password authentication is handled by Supabase Auth. Families store a name, timezone, membership roles and email-bound invitations.

When you save a memory, Dearweek stores its title, story, date, optional place, people, tags, audience and any selected photos. People mentioned in memories may not have Dearweek accounts. Only add information or photos you are entitled to share, and consider the privacy of the other people in them. Dates and places are supplied by you; the app does not request device location or upload your address book.

The app uses your selected photos for the memories you choose to save. Photo-library access does not mean the whole library is uploaded. Selected image files may contain embedded metadata, including when or where a photo was taken; metadata removal has not been established. The initial app does not include advertising, cross-app tracking, model/AI processing or behavioral analytics SDKs.

When you contact support, your reply address and message are used to respond to your request. The owner-provided destination is `alvaro.villalbaperez@icloud.com`. The support form's delivery behavior is verified separately from family-memory storage and account email delivery.

## Who can access a memory

You choose family access, private access, or selected current members. Selected people can have view or edit access. Owners and admins manage membership; that role does not automatically grant access to another person's private memory. Your family can see membership details needed to identify participants; invitation email addresses are limited to membership administrators.

The hosting service processes data to operate the app. Memories are not end-to-end encrypted: authorized service operators may have infrastructure-level access. Database rules and private photo storage restrict normal client access. Changing access or removing a member affects future service requests; it cannot recall photos, screenshots or text someone already downloaded or copied.

## Hosting and device storage

Supabase provides account authentication, the database, private photo storage and server functions. Vercel serves the web application. Native builds may be produced through Expo EAS when configured by the owner. The service providers can process technical request information, such as IP addresses and operational logs, under their service settings and policies: [Supabase privacy](https://supabase.com/privacy), [Vercel privacy](https://vercel.com/legal/privacy-policy), [Expo privacy](https://expo.dev/privacy).

The app stores a sign-in session on the device/browser to keep you signed in and downloads the memories you are allowed to view. Sign out on a shared device. Provider backups, logs and other operational retention follow the deployed service configuration; Dearweek does not promise immediate deletion from every backup or a retention period that the publisher has not verified.

## Your choices and deletion

You can change a memory's audience and archive or restore your own memories. Archiving hides a memory from the normal library; it does not erase its database record or photos.

Use the account deletion control in Family/account settings, or open the public `/delete-account` page on the Dearweek web app and sign in there. The web path must work without reinstalling the native app. Confirming account deletion removes the requesting account's authored memories, uploaded photos, memberships and Auth identity through the server deletion flow. It is permanent. If you own a family, first transfer ownership to another member or explicitly delete that family; family deletion removes its shared memories for all members.

Other members' independently authored memories do not become yours merely because they mention you. If such content needs correction or removal, contact the author or the family's administrator. Copies held by recipients and provider operational backups are outside the immediate app deletion transaction. For requests that cannot be completed through sign-in and the app controls, contact [alvaro.villalbaperez@icloud.com](mailto:alvaro.villalbaperez@icloud.com).

## Audience and policy changes

The initial product is intended for adults maintaining a family collection. It has not established a child-account or Kids-category release. The publisher must choose the admitted audience and complete the corresponding safeguards and store declarations before offering those uses.

Changes in features, service providers or retention settings require this information and the store privacy declarations to be reviewed together. Do not rely on a store label that describes an earlier build.
