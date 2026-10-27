import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { pickPhoto, saveMemory, uploadPhoto } from '../lib/api';
import { Family, FamilyRole, Member, Memory, MemoryDraft, PickedPhoto, Visibility } from '../types';
import { colors, common } from '../theme';
import { Button, Confirmation, Dialog, Field, Notice, Pill, errorMessage } from './ui';

interface QueuedPhoto { key: string; photo: PickedPhoto; state: 'queued' | 'uploading' | 'done' | 'failed'; error?: string }
export function MemoryEditor({ memory, family, members, userId, role, onClose, onSaved }: {
  memory: Memory | null; family: Family; members: Member[]; userId: string; role: FamilyRole; onClose: () => void; onSaved: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(memory?.title ?? ''); const [story, setStory] = useState(memory?.story ?? '');
  const [date, setDate] = useState(() => {
    if (memory) return memory.occurred_on;
    const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
  });
  const [place, setPlace] = useState(memory?.location ?? ''); const [people, setPeople] = useState(memory?.people.map(p => p.name).join(', ') ?? '');
  const [tags, setTags] = useState(memory?.tags.join(', ') ?? ''); const [visibility, setVisibility] = useState<Visibility>(memory?.visibility ?? 'family');
  const [recipients, setRecipients] = useState(memory?.recipients ?? []); const [savedId, setSavedId] = useState(memory?.id);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]); const [busy, setBusy] = useState(false); const [picking, setPicking] = useState(false);
  const [error, setError] = useState(''); const [photoNotice, setPhotoNotice] = useState(''); const [saved, setSaved] = useState(false); const [confirmClose, setConfirmClose] = useState(false);
  const [dirty, setDirty] = useState(false); const manageAudience = !memory || memory.author_id === userId;
  const photoCount = (memory?.photos.length ?? 0) + photos.length;
  const split = (value: string) => [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))];
  function markDirty() { setDirty(true); setSaved(false); setError(''); setPhotoNotice(''); }
  function change(setter: (value: string) => void, value: string) { setter(value); markDirty(); }
  function toggleRecipient(id: string) { setRecipients(current => current.some(r => r.user_id === id) ? current.filter(r => r.user_id !== id) : [...current, { user_id: id, can_edit: false }]); markDirty(); }
  async function choosePhoto() {
    if (photoCount >= 20) { setError('A memory can hold up to 20 photos. Remove a photo before adding another.'); return; }
    setPicking(true); setError('');
    try { const photo = await pickPhoto(); if (photo) setPhotos(current => [...current, { key: `${Date.now()}-${Math.random()}`, photo, state: 'queued' }]); } catch (e) { setError(errorMessage(e)); } finally { setPicking(false); }
  }
  async function uploadQueue(id: string, queue: QueuedPhoto[]) {
    let failed = false;
    for (const item of queue.filter(p => p.state !== 'done')) {
      setPhotos(current => current.map(p => p.key === item.key ? { ...p, state: 'uploading', error: undefined } : p));
      try { await uploadPhoto(id, item.photo); setPhotos(current => current.map(p => p.key === item.key ? { ...p, state: 'done', error: undefined } : p)); }
      catch (e) { failed = true; setPhotos(current => current.map(p => p.key === item.key ? { ...p, state: 'failed', error: errorMessage(e) } : p)); }
    }
    return !failed;
  }
  async function submit(retryOnly = false) {
    if (busy || picking) return;
    setError(''); setPhotoNotice('');
    const keepDraftOpen = retryOnly && dirty;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00Z`).valueOf()) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
    if (!retryOnly && (!title.trim() || !story.trim() || !validDate)) { setError('Add a title, a story and a valid date in YYYY-MM-DD format.'); return; }
    if (!retryOnly && visibility === 'selected' && recipients.length === 0) { setError('Choose at least one family member, or select Only me.'); return; }
    setBusy(true);
    try {
      let id = savedId;
      if (!retryOnly) {
        const draft: MemoryDraft = { ...(id ? { id } : {}), title: title.trim(), story: story.trim(), occurred_on: date, location: place.trim(), visibility, people: split(people), tags: split(tags), recipients: visibility === 'selected' ? recipients : [] };
        id = await saveMemory(family.id, draft); setSavedId(id); setDirty(false); setSaved(true);
      }
      if (!id) throw new Error('Save the memory before adding photos.');
      const complete = await uploadQueue(id, photos);
      await onSaved(id);
      if (complete) {
        if (keepDraftOpen) setPhotoNotice('Your photos are uploaded. Story or audience edits are still unsaved; choose Save changes to keep them.');
        else onClose();
      } else setError(keepDraftOpen ? 'Some photos did not upload. Your unsaved edits are still here. Retry the photos or save your changes below.' : 'Your story is saved. Some photos did not upload. Retry them below; successful photos will not upload again.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  function close() { if (busy || picking) return; if (dirty || photos.some(p => p.state !== 'done')) setConfirmClose(true); else onClose(); }
  return <Dialog title={memory ? 'A story, a little richer.' : 'What would you like to remember?'} eyebrow={memory ? 'EDIT MEMORY' : 'A MOMENT WORTH KEEPING'} onClose={close} wide>
    {error ? <Notice text={error} error /> : null}{photoNotice ? <Notice text={photoNotice} /> : null}{saved ? <Notice text="The memory is saved. Any unfinished photos are listed below." /> : null}
    {confirmClose ? <Confirmation title="Leave this memory?" description={savedId ? 'Saved changes will stay. Unsaved edits and photos still waiting to upload will be discarded.' : 'This draft and selected photos have not been saved.'} confirmLabel="Discard unsaved changes" busy={busy || picking} onConfirm={() => { if (!busy && !picking) onClose(); }} onCancel={() => setConfirmClose(false)} /> : null}
    <Field label="Give this memory a title" placeholder="A few words to bring it all back" value={title} maxLength={160} onChangeText={v => change(setTitle, v)} editable={!busy} />
    <Field label="The story" placeholder="What happened? What made it yours? A few lines is plenty." value={story} multiline maxLength={20000} onChangeText={v => change(setStory, v)} editable={!busy} />
    <View style={styles.fields}><View style={styles.half}><Field label="Memory date" value={date} onChangeText={v => change(setDate, v)} placeholder="YYYY-MM-DD" hint="When it happened, even if it was years ago." editable={!busy} /></View><View style={styles.half}><Field label="Place · optional" value={place} onChangeText={v => change(setPlace, v)} placeholder="Somewhere special, or just home" editable={!busy} maxLength={200} /></View></View>
    <Field label="People · optional" value={people} onChangeText={v => change(setPeople, v)} placeholder="Names, separated by commas" hint="Include anyone in the story, even if they don’t have an account." editable={!busy} />
    <Field label="Tags · optional" value={tags} onChangeText={v => change(setTags, v)} placeholder="Sunday lunch, summer, firsts" editable={!busy} />
    <View style={{ gap: 12 }}><Text style={styles.label}>Who can see this?</Text><View style={common.row}>{([['family', 'Our family'], ['private', 'Only me'], ['selected', 'Choose people']] as const).map(([value, label]) => <Pill key={value} label={label} active={visibility === value} onPress={manageAudience && !busy ? () => { setVisibility(value); markDirty(); } : undefined} />)}</View>
      {!manageAudience ? <Text style={common.muted}>Only the author can change who sees this memory.</Text> : visibility === 'selected' ? <View style={styles.audience}>{members.filter(m => m.user_id !== userId).map(member => { const recipient = recipients.find(r => r.user_id === member.user_id); return <View key={member.user_id} style={[common.row, { justifyContent: 'space-between' }]}><Pill label={`${recipient ? '✓ ' : ''}${member.display_name}`} active={!!recipient} onPress={!busy ? () => toggleRecipient(member.user_id) : undefined} />{recipient ? <Pill label={member.role === 'viewer' ? 'Viewer · can view' : recipient.can_edit ? 'Can edit' : 'Can view'} onPress={!busy && member.role !== 'viewer' ? () => { setRecipients(current => current.map(r => r.user_id === member.user_id ? { ...r, can_edit: !r.can_edit } : r)); markDirty(); } : undefined} /> : null}</View>; })}<Text style={common.muted}>A viewer’s family role always limits them to reading, even when a memory has an edit grant.</Text>{members.filter(m => m.user_id !== userId).length === 0 ? <Text style={common.muted}>Invite someone to your family before choosing people.</Text> : null}</View> : <Text style={common.muted}>{visibility === 'private' ? 'A private memory stays yours, including from family admins.' : 'Current family members can view this memory.'}</Text>}
    </View>
    <View style={{ gap: 12 }}><View style={[common.row, { justifyContent: 'space-between' }]}><Text style={styles.label}>Photos</Text><Button title="Add a photo" icon="image-outline" variant="secondary" small onPress={() => void choosePhoto()} busy={picking} disabled={busy || photoCount >= 20} /></View><Text style={common.muted}>{photoCount}/20 photos. {memory?.photos.length ? 'Existing photos are available in the memory. Add more here.' : 'A photo can hold a whole other part of the story.'}</Text>
      {photos.map(item => <View key={item.key} style={styles.photo}><Image source={{ uri: item.photo.uri }} style={styles.thumbnail} accessibilityLabel={`Selected photo ${item.photo.fileName}`} /><View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={common.body}>{item.photo.fileName}</Text><Text style={[common.muted, item.state === 'failed' && { color: colors.danger }]}>{item.state === 'done' ? 'Uploaded' : item.state === 'uploading' ? 'Uploading…' : item.state === 'failed' ? item.error : 'Ready to upload'}</Text></View>{item.state !== 'done' ? <Button title="Remove" variant="quiet" small disabled={busy} onPress={() => setPhotos(current => current.filter(p => p.key !== item.key))} /> : null}</View>)}
      {photos.some(p => p.state === 'failed') && savedId ? <Button title="Retry unfinished photos" icon="refresh-outline" variant="secondary" busy={busy} disabled={picking} onPress={() => void submit(true)} /> : null}
    </View>
    <View style={styles.footer}><Text style={[common.muted, { flex: 1, minWidth: 180 }]}>A new memory counts toward the week it is added, in {family.timezone}.</Text><Button title={savedId ? 'Save changes' : 'Save memory'} icon="checkmark-outline" onPress={() => void submit()} busy={busy} disabled={picking || role === 'viewer'} /></View>
  </Dialog>;
}
const styles = StyleSheet.create({ fields: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, half: { flex: 1, minWidth: 220 }, label: { fontSize: 13, fontWeight: '600', color: colors.ink }, audience: { gap: 10, padding: 15, borderRadius: 12, backgroundColor: colors.pale }, photo: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, thumbnail: { width: 60, height: 60, borderRadius: 8 }, footer: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, borderTopWidth: 1, borderColor: colors.line } });
