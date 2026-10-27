import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { publicProject } from '../../supabase/functions/_shared/project';
import type { Family, FamilyData, FamilyRole, Invitation, Member, Memory, MemoryDraft, Person, Photo, PickedPhoto, Profile, Recipient } from '../types';

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || publicProject.url;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicProject.publishableKey;
export const emailDeliveryVerified = publicProject.emailDeliveryVerified;
export const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl)
  && /^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) && publishableKey.length > 20;
export const supabase = isConfigured ? createClient(projectUrl, publishableKey, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock },
}) : null;

if (Platform.OS !== 'web' && supabase) {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

function client() {
  if (!supabase) throw new Error('Dearweek is not connected yet. Please try again after setup is complete.');
  return supabase;
}
async function rpc<T = void>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function redirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/`;
  return Linking.createURL('auth/callback');
}

export async function completeAuthUrl(url: string): Promise<'recovery' | 'signed_in' | null> {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const error = parsed.searchParams.get('error_description') ?? hash.get('error_description');
  if (error) throw new Error(error);
  const code = parsed.searchParams.get('code');
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  let recovered = hash.get('type') === 'recovery' || parsed.searchParams.get('type') === 'recovery';
  if (!code && !(accessToken && refreshToken)) return null;
  // Recovery is an Auth event for PKCE, rather than a URL type parameter.
  const { data: { subscription } } = client().auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') recovered = true;
  });
  try {
    const result = code ? await client().auth.exchangeCodeForSession(code) : await client().auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
    if (result.error) throw new Error(`${result.error.message}. Open the link on the device where you requested it, or request a new link.`);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const clean = new URL(window.location.href);
      clean.hash = '';
      ['code', 'type', 'error', 'error_description', 'error_code'].forEach(key => clean.searchParams.delete(key));
      window.history.replaceState({}, '', clean.pathname + clean.search);
    }
    return recovered ? 'recovery' : 'signed_in';
  } finally { subscription.unsubscribe(); }
}

async function allRows<T>(table: string, columns = '*', familyId?: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 200) {
    let query = client().from(table).select(columns).order(table === 'family_members' ? 'user_id' : 'id');
    if (familyId) query = query.eq('family_id', familyId);
    const { data, error } = await query.range(offset, offset + 199);
    if (error) throw new Error(error.message);
    result.push(...(data as unknown as T[]));
    if (!data || data.length < 200) return result;
  }
}

type MemoryRecord = Omit<Memory, 'people' | 'recipients' | 'photos'> & {
  memory_people: { people: Person }[]; memory_recipients: Recipient[]; photos: Photo[];
};
export async function loadFamilyData(familyId?: string): Promise<FamilyData> {
  const families = await allRows<Family>('families');
  families.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const family = families.find(item => item.id === familyId) ?? families[0];
  if (!family) return { families, members: [], memories: [], invitations: [] };
  const [members, records] = await Promise.all([
    allRows<Omit<Member, 'display_name'>>('family_members', '*', family.id),
    allRows<MemoryRecord>('memories', '*,memory_people(people(*)),memory_recipients(user_id,can_edit),photos(*)', family.id),
  ]);
  const userIds = members.map(member => member.user_id);
  const { data: profiles, error } = await client().from('profiles').select('id,display_name').in('id', userIds);
  if (error) throw new Error(error.message);
  const names = new Map((profiles as Profile[]).map(profile => [profile.id, profile.display_name]));
  const { data: { user }, error: userError } = await client().auth.getUser();
  if (userError) throw new Error(userError.message);
  const role = members.find(member => member.user_id === user?.id)?.role;
  const invitations = role === 'owner' || role === 'admin' ? await allRows<Invitation>('invitations', '*', family.id) : [];
  return {
    families, members: members.map(member => ({ ...member, display_name: names.get(member.user_id) || 'Family member' })), invitations,
    memories: records.map(({ memory_people, memory_recipients, ...memory }) => ({
      ...memory, people: (memory_people ?? []).map(link => link.people).filter(Boolean),
      recipients: memory_recipients ?? [], photos: memory.photos ?? [],
    })).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)),
  };
}

export const createFamily = (name: string, timezone: string) => rpc<string>('create_family', { p_name: name.trim(), p_timezone: timezone });
export async function createInvitation(familyId: string, email: string, role: Exclude<FamilyRole, 'owner'>): Promise<string> {
  const token = await rpc<string>('create_invitation', { p_family_id: familyId, p_email: email.trim().toLowerCase(), p_role: role });
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL || publicProject.siteUrl;
  if (!base) throw new Error('The web invitation address is not configured. Ask the owner to finish setup.');
  return `${base}/?invite=${encodeURIComponent(token)}`;
}
export const acceptInvitation = (token: string) => rpc<string>('accept_invitation', { p_token: token.trim() });
export const setMemberRole = (familyId: string, userId: string, role: Exclude<FamilyRole, 'owner'>) => rpc('set_member_role', { p_family_id: familyId, p_user_id: userId, p_role: role });
export const removeMember = (familyId: string, userId: string) => rpc('remove_member', { p_family_id: familyId, p_user_id: userId });
export const transferOwnership = (familyId: string, userId: string) => rpc('transfer_ownership', { p_family_id: familyId, p_user_id: userId });
export const saveMemory = (familyId: string, draft: MemoryDraft) => rpc<string>('save_memory', {
  p_family_id: familyId, p_title: draft.title.trim(), p_story: draft.story.trim(), p_occurred_on: draft.occurred_on,
  p_location: draft.location.trim(), p_visibility: draft.visibility, p_people: draft.people, p_tags: draft.tags,
  p_recipients: draft.recipients, p_memory_id: draft.id ?? null,
});
export const archiveMemory = (memoryId: string, archived: boolean) => rpc('archive_memory', { p_memory_id: memoryId, p_archived: archived });

export function canEdit(memory: Memory, userId: string, role: FamilyRole): boolean {
  return role !== 'viewer' && (memory.author_id === userId || memory.recipients.some(recipient => recipient.user_id === userId && recipient.can_edit));
}

const maxPhotoBytes = 8 * 1024 * 1024;
const photoBucket = 'memory-photos';
export async function pickPhoto(): Promise<PickedPhoto | null> {
  // The system picker grants access only to the selected image; no full-library,
  // camera, microphone or contact permission is requested.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false });
  if (result.canceled || !result.assets[0]) return null;
  const picked = result.assets[0];
  const context = ImageManipulator.manipulate(picked.uri, { maxWidth: 2400, maxHeight: 2400 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  context.release();
  rendered.release();
  const fileSize = Platform.OS === 'web' ? (await (await fetch(image.uri)).blob()).size : new File(image.uri).size;
  if (!fileSize || fileSize > maxPhotoBytes) throw new Error('This photo is too large. Choose a photo smaller than 8 MB.');
  return { uri: image.uri, mimeType: 'image/jpeg', fileName: 'memory.jpg', fileSize };
}

export async function uploadPhoto(memoryId: string, photo: PickedPhoto): Promise<void> {
  const body = Platform.OS === 'web' ? await (await fetch(photo.uri)).arrayBuffer() : await new File(photo.uri).arrayBuffer();
  if (!body.byteLength || body.byteLength > maxPhotoBytes) throw new Error('Photos must be between 1 byte and 8 MB.');
  const header = new Uint8Array(body, 0, Math.min(3, body.byteLength));
  if (photo.mimeType !== 'image/jpeg' || header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) throw new Error('Choose a valid photo using the photo picker.');
  const reserved = await rpc<Photo>('reserve_photo', { p_memory_id: memoryId, p_content_type: photo.mimeType, p_byte_size: body.byteLength });
  try {
    const { error } = await client().storage.from(photoBucket).upload(reserved.storage_path, body, { contentType: photo.mimeType, upsert: false, cacheControl: '0' });
    if (error) throw new Error(error.message);
    await rpc('complete_photo', { p_photo_id: reserved.id });
  } catch (error) {
    try { await removePhoto(reserved); }
    catch { throw new Error('The photo could not be attached. Refresh this memory, remove its pending photo, and try again. Your story is saved.'); }
    throw new Error(`The photo was not saved. ${error instanceof Error ? error.message : 'Please try again.'}`);
  }
}

const photoCache = new Map<string, string>();
let photoGeneration = 0;
export function clearPhotoCache(): void {
  photoGeneration++;
  for (const uri of photoCache.values()) if (uri.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(uri);
  photoCache.clear();
}
export async function loadPhoto(photo: Photo, options: { force?: boolean } = {}): Promise<string> {
  if (photo.state !== 'ready') throw new Error('This photo has not finished uploading.');
  const generation = photoGeneration;
  const { data: { user }, error: authError } = await client().auth.getUser();
  if (authError || !user) throw new Error('Sign in again to view this photo.');
  if (generation !== photoGeneration) throw new Error('The family view changed while this photo loaded. Open the photo again.');
  const key = `${user.id}:${photo.id}`;
  if (options.force) {
    const previous = photoCache.get(key);
    if (previous?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previous);
    photoCache.delete(key);
  }
  const cached = photoCache.get(key);
  if (cached) return cached;
  const { data, error } = await client().storage.from(photoBucket).download(photo.storage_path);
  if (error) throw new Error(error.message);
  let uri: string;
  if (Platform.OS === 'web') uri = URL.createObjectURL(data);
  else uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This photo could not be opened. Please retry.'));
    reader.readAsDataURL(data);
  });
  if (generation !== photoGeneration) {
    if (uri.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(uri);
    throw new Error('The family view changed while this photo loaded. Open the photo again.');
  }
  const concurrent = photoCache.get(key);
  if (concurrent) {
    if (uri.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(uri);
    return concurrent;
  }
  photoCache.set(key, uri);
  return uri;
}
export async function removePhoto(photo: Photo): Promise<void> {
  const { error } = await client().storage.from(photoBucket).remove([photo.storage_path]);
  if (error) throw new Error(error.message);
  await rpc('remove_photo', { p_photo_id: photo.id });
  clearPhotoCache();
}

async function invokeDeletion(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await client().functions.invoke(name, { body });
  if (error) {
    const response = 'context' in error ? error.context as Response : undefined;
    let detail: string | undefined;
    try { detail = (await response?.json())?.error; } catch { /* Use the transport error when no structured response is available. */ }
    throw new Error(detail || error.message);
  }
  if (!data?.ok) throw new Error(data?.error || 'Deletion did not finish. Please retry.');
  clearPhotoCache();
}
export async function deleteAccount(): Promise<void> {
  await invokeDeletion('delete-account', { confirm: true });
  await client().auth.signOut({ scope: 'local' });
}
export const deleteFamily = (familyId: string) => invokeDeletion('delete-family', { family_id: familyId, confirm: true });

function localDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function getMemoryWeek(timestamp: string, timezone: string): string {
  const date = new Date(`${localDate(new Date(timestamp), timezone)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export const getWeekStart = (timezone: string) => getMemoryWeek(new Date().toISOString(), timezone);
