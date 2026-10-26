export type FamilyRole = 'owner' | 'admin' | 'member' | 'viewer';
export type Visibility = 'family' | 'private' | 'selected';
export interface Profile { id: string; display_name: string }
export interface Family { id: string; name: string; timezone: string; owner_id: string; created_at: string }
export interface Member { family_id: string; user_id: string; role: FamilyRole; joined_at: string; display_name: string }
export interface Invitation { id: string; family_id: string; email: string; role: Exclude<FamilyRole, 'owner'>; expires_at: string; accepted_at: string | null; created_at: string }
export interface Person { id: string; family_id: string; name: string }
export interface Recipient { user_id: string; can_edit: boolean }
export interface Photo { id: string; memory_id: string; uploader_id: string; storage_path: string; content_type: string; byte_size: number; state: 'pending' | 'ready'; created_at: string; url?: string }
export interface Memory {
  id: string; family_id: string; author_id: string; title: string; story: string;
  occurred_on: string; location: string; visibility: Visibility; tags: string[];
  created_at: string; updated_at: string; archived_at: string | null;
  people: Person[]; recipients: Recipient[]; photos: Photo[];
}
export interface MemoryDraft {
  id?: string; title: string; story: string; occurred_on: string; location: string;
  visibility: Visibility; people: string[]; tags: string[]; recipients: Recipient[];
}
export interface FamilyData { families: Family[]; members: Member[]; memories: Memory[]; invitations: Invitation[] }
export interface PickedPhoto { uri: string; mimeType: string; fileName: string; fileSize?: number }
