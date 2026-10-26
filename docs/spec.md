# Welyto product and release contract

Source: [Welyto in Notion](https://app.notion.com/p/3fea1ee8bd06804bbfc1db4d900bbdd5), inspected 2026-10-26. The brief asks for weekly memories contributed by the whole family, shared family access with admin/custom permissions, a structured memory data model, and releases on the App Store and Google Play. These four requirements are the source scope; the implementation choices below make them concrete.

## Experience

- Create an account with verified email, sign in, reset a password, create a family, or join an email-bound invitation. Invitation links are shared by the inviting person; Welyto does not send invitations on their behalf.
- Save a memory with a title, story, memory date, optional place, people, tags and photos. A memory may be visible to the family, only its author, or selected current members. Selected members may receive view or edit access.
- Browse and search memories by title/story/place/tag/person, filter by person, and revisit the week's contributions. A contribution counts in the Monday-based week of its creation in the family's timezone, not the historical memory date. Only visible contributions count in the viewer's recap.
- Owners and admins invite and remove members. Owners appoint admins and transfer ownership; admins cannot promote themselves or change the owner. Members contribute; viewers read. Removing a member revokes fresh API and original-photo access. Previously downloaded copies cannot be recalled.
- An author's private memory is not automatically visible to an admin. Membership administration never implies audience access. Editors cannot change a memory's author or family. Only authors change audiences or archive their memories.
- Show loading, empty, error, retry and narrow-screen states. Failed saves retain the draft; photo failures are explicitly identified. No fake family content, fabricated activity, or optimistic persistence claims.

## Data and transport

Supabase PostgreSQL owns families, live membership, invitations, memories, audience grants, family people, memory-person links and photo metadata. Photos use a private Storage bucket. All exposed tables use RLS. Sensitive mutations use narrow invoker RPCs calling intentionally privileged implementations in a non-exposed schema with a fixed search path and explicit caller checks. Raw invite tokens are returned once and only their hashes are stored.

Each memory accepts up to 20 pending/ready photos of at most 8 MiB each. The native/web picker re-encodes selected images as JPEG; the server bucket accepts JPEG, PNG and WebP from authorized clients. Metadata stripping and actual native picker behavior require device verification before a privacy claim is made about them.

`src/types.ts` defines the shared client shapes. The database implements these public RPCs (parameter names are transport contracts):

| RPC | Parameters | Result |
| --- | --- | --- |
| `create_family` | `p_name`, `p_timezone` | family UUID |
| `create_invitation` | `p_family_id`, `p_email`, `p_role` | raw token (text), expires after seven days |
| `accept_invitation` | `p_token` | family UUID; requires matching verified email |
| `set_member_role` | `p_family_id`, `p_user_id`, `p_role` | void |
| `remove_member` | `p_family_id`, `p_user_id` | void; owner must transfer first |
| `transfer_ownership` | `p_family_id`, `p_user_id` | void |
| `save_memory` | `p_family_id`, `p_title`, `p_story`, `p_occurred_on`, `p_location`, `p_visibility`, `p_people` (text array), `p_tags` (text array), `p_recipients` (JSON array of `{user_id,can_edit}`), `p_memory_id` (nullable UUID) | memory UUID |
| `archive_memory` | `p_memory_id`, `p_archived` (boolean) | void |
| `reserve_photo` | `p_memory_id`, `p_content_type`, `p_byte_size` | photo row as JSON; `id`, `storage_path`, `state` |
| `complete_photo` | `p_photo_id` | void; verifies uploaded object |
| `remove_photo` | `p_photo_id` | void; only after Storage removal succeeds |

Read tables: `profiles(id,display_name)`, `families(id,name,timezone,owner_id,created_at)`, `family_members(family_id,user_id,role,joined_at)`, `invitations(id,family_id,email,role,expires_at,accepted_at,created_at)` (admins only), `memories(id,family_id,author_id,title,story,occurred_on,location,visibility,tags,created_at,updated_at,archived_at)`, `people(id,family_id,name)`, `memory_people(memory_id,person_id)`, `memory_recipients(memory_id,user_id,can_edit)`, `photos(id,memory_id,uploader_id,storage_path,content_type,byte_size,state,created_at)`. Photo states are `pending` and `ready`; family roles are `owner`, `admin`, `member`, `viewer`; audiences are `family`, `private`, `selected`.

Account deletion uses a JWT-verified Edge Function with a server-only administrative key. It deletes the requesting user's authored memories, uploads, memberships and Auth identity; a family owner first transfers ownership or explicitly deletes their family. No automatic expiry of unrelated family memories is implied. The public web deletion route explains this same authenticated path. Native store declarations must reflect the actual implementation and hosting retention, with owner review before submission.

Deletion begins with an authenticated database marker that blocks new writes and uploads. Narrow RPCs `begin_account_deletion`, `finish_account_deletion`, `begin_family_deletion(p_family_id)`, `finish_family_deletion(p_family_id)` and `deletion_photo_paths(p_family_id, p_limit)` coordinate bounded Storage cleanup and database finalization. The `delete-account` Edge Function requires POST `{confirm:true}`; `delete-family` requires POST `{family_id,confirm:true}`. Failures preserve a retryable marker. An owner must transfer or explicitly delete each owned family before account deletion.

## Release boundaries

Expo SDK 58 supplies native iOS/Android projects and a Vercel web export. Native identifiers are `com.alvarovillalbaa.welyto` pending store registration. EAS profiles express preview APK/simulator and store AAB/iOS builds. Signing, developer accounts, binary builds, device checks and store review are separate acceptance gates. No account, subscription or legal agreement is created or accepted silently.

Email confirmation stays enabled. Supabase default email delivery can be restricted; production SMTP and delivery proof are explicit release requirements. No autoconfirm workaround is allowed. The app does not include AI, notifications, contacts import or offline synchronization: the source brief does not request them.

Implementation references: [Expo SDK 58 map](https://github.com/expo/expo/blob/sdk-58/packages/expo/bundledNativeModules.json), [Expo web deployment](https://docs.expo.dev/guides/publishing-websites/), [Supabase Expo Auth](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-sign-in), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
