import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { acceptInvitation, clearPhotoCache, completeAuthUrl, createFamily, deleteAccount, isConfigured, loadFamilyData, supabase } from './src/lib/api';
import { Family, FamilyData, FamilyRole, Member, Memory } from './src/types';
import { colors, common, serif } from './src/theme';
import { AuthScreen } from './src/components/AuthScreen';
import { FamilySettings } from './src/components/FamilySettings';
import { MemoryEditor } from './src/components/MemoryEditor';
import { LibraryView, MemoryDetail, WeekView } from './src/components/MemoryViews';
import { PublicInfo } from './src/components/PublicInfo';
import { Button, Confirmation, Dialog, EmptyState, Field, Icon, IconName, Notice, errorMessage } from './src/components/ui';

type Tab = 'week' | 'library' | 'family';
type InfoPage = 'privacy' | 'delete-account';
const INVITE_KEY = 'welyto.pending-invitation';
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'week', label: 'This week', icon: 'sunny-outline' },
  { id: 'library', label: 'Memory library', icon: 'albums-outline' },
  { id: 'family', label: 'Our family', icon: 'people-outline' },
];

function AppContent() {
  const { width } = useWindowDimensions(); const desktop = width >= 1000;
  const [session, setSession] = useState<Session | null>(null); const [authReady, setAuthReady] = useState(!supabase); const [recovery, setRecovery] = useState(false);
  const [data, setData] = useState<FamilyData | null>(null); const [familyId, setFamilyId] = useState<string>(); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const [tab, setTab] = useState<Tab>('week'); const [editor, setEditor] = useState<Memory | null | undefined>(); const [detailId, setDetailId] = useState<string>();
  const [invite, setInvite] = useState(''); const [inviteBusy, setInviteBusy] = useState(false); const [inviteError, setInviteError] = useState('');
  const [info, setInfo] = useState<InfoPage | null>(null); const [familyChooser, setFamilyChooser] = useState(false); const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false); const [deleteBusy, setDeleteBusy] = useState(false);
  const identity = useRef<string | null>(null); const request = useRef(0); const currentFamily = useRef<string | undefined>(undefined);
  const editorSnapshot = useRef<{ family: Family; members: Member[]; role: FamilyRole } | null>(null);
  const userId = session?.user.id;
  const family = data?.families.find(f => f.id === familyId) ?? data?.families[0];
  const role: FamilyRole | undefined = data?.members.find(m => m.user_id === userId)?.role;
  const detail = data?.memories.find(m => m.id === detailId);

  const refresh = useCallback(async (selectedId?: string) => {
    if (!identity.current) return;
    const sequence = ++request.current; const forUser = identity.current; setLoading(true); setError(''); clearPhotoCache();
    try {
      const next = await loadFamilyData(selectedId ?? currentFamily.current);
      if (sequence !== request.current || identity.current !== forUser) return;
      const active = next.families.find(f => f.id === (selectedId ?? currentFamily.current)) ?? next.families[0];
      currentFamily.current = active?.id; setFamilyId(active?.id); setData(next);
    } catch (e) {
      if (sequence === request.current && identity.current === forUser) { setData(null); setDetailId(undefined); setError(errorMessage(e)); }
      throw e;
    } finally { if (sequence === request.current) setLoading(false); }
  }, []);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(INVITE_KEY).then(value => { if (live && value) setInvite(value); }).catch(() => { if (live) setInviteError('Your saved invitation could not be read. Open the invitation link again.'); });
    async function handleUrl(url: string) {
      try {
        const parsed = new URL(url);
        const page = parsed.searchParams.get('info') || parsed.pathname.replace(/^\/+|\/+$/g, '');
        setInfo(page === 'privacy' || page === 'delete-account' ? page : null);
        const token = parsed.searchParams.get('invite');
        if (token) { if (!/^[A-Za-z0-9_-]{20,512}$/.test(token)) throw new Error('This invitation link is not valid. Ask your family for a new link.'); await AsyncStorage.setItem(INVITE_KEY, token); if (live) setInvite(token); }
        const completed = await completeAuthUrl(url);
        if (live && completed === 'recovery') setRecovery(true);
      } catch (e) { if (live) setError(errorMessage(e)); }
    }
    Linking.getInitialURL().then(url => { if (url && live) void handleUrl(url); }).catch(e => { if (live) setError(errorMessage(e)); });
    const links = Linking.addEventListener('url', event => void handleUrl(event.url));
    const onPopState = () => {
      if (!live || typeof window === 'undefined') return;
      const parsed = new URL(window.location.href);
      const page = parsed.searchParams.get('info') || parsed.pathname.replace(/^\/+|\/+$/g, '');
      setInfo(page === 'privacy' || page === 'delete-account' ? page : null);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('popstate', onPopState);
    const cleanupLinks = () => {
      live = false; links.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('popstate', onPopState);
    };
    if (!supabase) return cleanupLinks;
    let authEventSeen = false;
    const subscription = supabase.auth.onAuthStateChange((event, next) => {
      if (!live) return;
      authEventSeen = true;
      if (identity.current !== (next?.user.id ?? null)) {
        ++request.current; clearPhotoCache(); setData(null); setFamilyId(undefined); currentFamily.current = undefined; setEditor(undefined); setDetailId(undefined); setError(''); setToast('');
      }
      identity.current = next?.user.id ?? null; setSession(next); setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!next) setRecovery(false);
    });
    supabase.auth.getSession().then(({ data: auth, error: authError }) => {
      if (!live || authEventSeen) return; if (authError) setError(authError.message); identity.current = auth.session?.user.id ?? null; setSession(auth.session); setAuthReady(true);
    }).catch(e => { if (live) { setError(errorMessage(e)); setAuthReady(true); } });
    return () => { cleanupLinks(); subscription.data.subscription.unsubscribe(); clearPhotoCache(); };
  }, []);

  useEffect(() => { if (userId && !recovery) void refresh().catch(() => undefined); }, [userId, recovery, refresh]);
  useEffect(() => {
    const state = AppState.addEventListener('change', next => { if (next === 'active' && identity.current && !recovery) void refresh().catch(() => undefined); });
    return () => state.remove();
  }, [refresh, recovery]);

  async function signOut() {
    clearPhotoCache(); ++request.current; setData(null); setEditor(undefined); setDetailId(undefined);
    if (supabase) { const result = await supabase.auth.signOut(); if (result.error) throw result.error; }
    setSession(null); identity.current = null; currentFamily.current = undefined; setFamilyId(undefined);
  }
  async function accept() {
    setInviteBusy(true); setInviteError('');
    try {
      const id = await acceptInvitation(invite); await AsyncStorage.removeItem(INVITE_KEY); setInvite('');
      if (Platform.OS === 'web' && typeof window !== 'undefined') { const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); }
      currentFamily.current = id; setFamilyId(id); await refresh(id); setToast('You’re part of the family. Make yourself at home.');
    } catch (e) { setInviteError(errorMessage(e)); } finally { setInviteBusy(false); }
  }
  async function dismissInvitation() { try { await AsyncStorage.removeItem(INVITE_KEY); setInvite(''); setInviteError(''); if (Platform.OS === 'web' && typeof window !== 'undefined') { const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); } } catch (e) { setInviteError(errorMessage(e)); } }
  function familyRemoved() { currentFamily.current = undefined; setFamilyId(undefined); setData(null); setCreateOpen(false); void refresh().catch(() => undefined); }
  function closeInfo() { setInfo(null); if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState({}, '', '/'); }
  function openInfo(page: InfoPage) { setInfo(page); if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.pushState({}, '', `/${page}`); }
  function signInToDelete() { closeInfo(); setTab('family'); }
  const openNew = () => { if (!family || !data || !role) return; editorSnapshot.current = { family, members: data.members, role }; setEditor(null); };
  const busyPage = <View style={styles.center}><ActivityIndicator color={colors.olive} size="large" /><Text style={common.muted}>Opening your family’s story…</Text></View>;

  if (info) return <PublicInfo page={info} onBack={closeInfo} onSignIn={signInToDelete} configured={isConfigured} />;
  if (!isConfigured) return <ScrollView contentContainerStyle={styles.center}><View style={{ maxWidth: 550, gap: 24, alignItems: 'center' }}><Logo /><Text style={[common.heading, { textAlign: 'center' }]}>A home for the stories{`\n`}you share.</Text><Notice text="Welyto’s family service is not connected yet. Accounts and saving will become available once setup is complete." /><View style={common.row}><Button title="Privacy" variant="quiet" onPress={() => openInfo('privacy')} /><Button title="Account deletion" variant="quiet" onPress={() => openInfo('delete-account')} /></View></View></ScrollView>;
  if (!authReady) return busyPage;
  if (!session || recovery) return <View style={{ flex: 1 }}>{error ? <Notice error text={error} /> : null}<AuthScreen recovery={recovery} invitation={!!invite} onRecoveryDone={() => { setRecovery(false); setToast('Your password has been updated.'); }} onInfo={openInfo} /></View>;

  const navigation = (mobile = false) => <View style={mobile ? styles.bottomNav : styles.nav}>{tabs.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)} style={({ pressed, focused }: any) => [mobile ? styles.bottomNavItem : styles.navItem, tab === item.id && (mobile ? { backgroundColor: colors.pale } : styles.selectedNav), pressed && { opacity: 0.7 }, focused && { borderColor: colors.terracotta }]}><Icon name={item.icon} color={tab === item.id ? colors.olive : colors.muted} size={mobile ? 21 : 20} /><Text style={[mobile ? styles.bottomNavLabel : styles.navLabel, tab === item.id && { color: colors.olive, fontWeight: '700' }]}>{mobile && item.id === 'library' ? 'Library' : mobile && item.id === 'family' ? 'Family' : item.label}</Text></Pressable>)}</View>;
  return <View style={[styles.app, desktop && { flexDirection: 'row' }]}>
    {desktop ? <View style={styles.sidebar}><Logo /><View style={{ marginTop: 36, marginBottom: 26 }}><Pressable accessibilityRole="button" accessibilityLabel="Choose a family" onPress={() => setFamilyChooser(true)} style={styles.familySwitch}><View style={styles.familyBadge}><Icon name="home-outline" size={20} color={colors.olive} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.smallEyebrow}>YOUR FAMILY</Text><Text numberOfLines={1} style={styles.familyName}>{family?.name ?? 'A new beginning'}</Text></View><Icon name="chevron-down-outline" size={14} color={colors.muted} /></Pressable></View>{navigation()}<View style={styles.sidebarQuote}><Icon name="leaf-outline" size={27} color={colors.olive} /><Text style={styles.quote}>Some things are{`\n`}too good to forget.</Text><View style={{ height: 1, backgroundColor: colors.line, marginVertical: 18 }} /><Text style={styles.smallEyebrow}>ONE MEMORY. EVERY WEEK.</Text></View><View style={{ marginTop: 'auto', gap: 8 }}><Button title={data?.members.find(m => m.user_id === userId)?.display_name || session.user.email || 'Your account'} variant="quiet" icon="person-circle-outline" onPress={() => setTab('family')} /><View style={common.row}><Button title="Privacy" variant="quiet" small onPress={() => openInfo('privacy')} /><Button title="Sign out" variant="quiet" small onPress={() => void signOut().catch(e => setError(errorMessage(e)))} /></View></View></View> : <View style={styles.mobileHeader}><Logo compact /><Button title={family?.name ?? 'Your family'} small variant="quiet" icon="chevron-down-outline" onPress={() => setFamilyChooser(true)} /></View>}
    <View style={{ flex: 1, minWidth: 0 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.main, !desktop && { padding: 20, paddingTop: 25 }]}><View style={styles.content}>
      <View style={[common.row, { justifyContent: 'space-between', marginBottom: 15 }]}><Text style={styles.smallEyebrow}>{family ? `${family.name.toUpperCase()} · A SHARED LIFE` : 'WELCOME TO WELYTO'}</Text><Button title="Refresh" icon="refresh-outline" variant="quiet" small busy={loading && !!data} onPress={() => void refresh().catch(() => undefined)} /></View>
      {toast ? <Notice text={toast} action="Dismiss" onAction={() => setToast('')} /> : null}{error ? <Notice error text={error} action="Try again" onAction={() => void refresh().catch(() => undefined)} /> : null}
      {invite ? <View style={[common.card, { gap: 13, backgroundColor: colors.blush }]}><Text style={common.subheading}>There’s a place for you.</Text><Text style={common.muted}>Accept your family invitation using {session.user.email}. The invitation must match this verified email address.</Text>{inviteError ? <Notice error text={inviteError} /> : null}<View style={common.row}><Button title="Accept invitation" icon="heart-outline" busy={inviteBusy} onPress={() => void accept()} /><Button title="Dismiss invitation" variant="quiet" disabled={inviteBusy} onPress={() => void dismissInvitation()} /></View></View> : inviteError ? <Notice error text={inviteError} /> : null}
      {loading && !data ? busyPage : data && family && role ? tab === 'week' ? <WeekView family={family} memories={data.memories} members={data.members} userId={userId!} role={role} onNew={openNew} onOpen={m => setDetailId(m.id)} /> : tab === 'library' ? <LibraryView memories={data.memories} members={data.members} role={role} onNew={openNew} onOpen={m => setDetailId(m.id)} /> : <FamilySettings key={family.id} data={data} family={family} userId={userId!} email={session.user.email} role={role} onRefresh={() => refresh(family.id)} onFamilyRemoved={familyRemoved} onSignOut={signOut} /> : data && !data.families.length ? <View style={{ gap: 25 }}><EmptyState title="Your family’s story starts here" description="Create a private home for your family, then invite the people who make it yours. Already invited? Open the invitation link while signed in." action="Create a family" onAction={() => setCreateOpen(true)} icon="home-outline" /><View style={[common.card, { gap: 15 }]}><Text style={common.subheading}>Your account</Text><Text style={common.muted}>{session.user.email}</Text><View style={common.row}><Button title="Sign out" onPress={() => void signOut().catch(e => setError(errorMessage(e)))} variant="secondary" /><Button title="Delete my account" variant="quiet" onPress={() => setDeleteConfirm(true)} /></View>{deleteConfirm ? <Confirmation title="Permanently delete your account?" description="Your identity, authored memories and uploaded photos will be deleted. This cannot be undone. If interrupted, sign in and retry to finish." confirmLabel="Delete my account" busy={deleteBusy} onConfirm={() => { setDeleteBusy(true); void deleteAccount().then(signOut).catch(e => setError(errorMessage(e))).finally(() => setDeleteBusy(false)); }} onCancel={() => setDeleteConfirm(false)} /> : null}</View></View> : !loading && !error ? <Notice error text="We couldn’t establish your family membership. Refresh to check your access again." action="Refresh" onAction={() => void refresh().catch(() => undefined)} /> : null}
      <View style={[common.row, { justifyContent: 'center', paddingVertical: 15 }]}><Icon name="leaf-outline" color={colors.muted} size={13} /><Text style={[common.muted, { fontSize: 11 }]}>A little closer, one memory at a time.</Text><Button title="Privacy" small variant="quiet" onPress={() => openInfo('privacy')} /><Button title="Account deletion" small variant="quiet" onPress={() => openInfo('delete-account')} /></View>
    </View></ScrollView>{!desktop ? navigation(true) : null}</View>
    {familyChooser ? <Dialog title="A place for every part of your family" eyebrow="YOUR FAMILIES" onClose={() => setFamilyChooser(false)}>{data?.families.map(item => <Button key={item.id} title={`${item.name}${family?.id === item.id ? ' · current' : ''}`} icon="home-outline" variant="secondary" onPress={() => { setFamilyChooser(false); clearPhotoCache(); setDetailId(undefined); setEditor(undefined); setData(null); currentFamily.current = item.id; setFamilyId(item.id); void refresh(item.id).catch(() => undefined); }} />)}<Button title="Create another family" icon="add-outline" onPress={() => { setFamilyChooser(false); setCreateOpen(true); }} /></Dialog> : null}
    {createOpen ? <CreateFamily onClose={() => setCreateOpen(false)} onCreated={async id => { currentFamily.current = id; setFamilyId(id); await refresh(id); setTab('week'); setCreateOpen(false); }} /> : null}
    {editor !== undefined && editorSnapshot.current && userId ? <MemoryEditor key={editor?.id ?? 'new'} memory={editor} family={editorSnapshot.current.family} members={data?.members ?? editorSnapshot.current.members} userId={userId} role={role ?? editorSnapshot.current.role} onClose={() => setEditor(undefined)} onSaved={async () => { await refresh(editorSnapshot.current!.family.id); setToast('Your memory is kept.'); }} /> : null}
    {detail && data && role && family ? <MemoryDetail key={detail.id} memory={detail} members={data.members} userId={userId!} role={role} onClose={() => { setDetailId(undefined); clearPhotoCache(); }} onEdit={() => { editorSnapshot.current = { family, members: data.members, role }; setDetailId(undefined); clearPhotoCache(); setEditor(detail); }} onRefresh={() => refresh(family.id)} /> : null}
  </View>;
}

function CreateFamily({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [createdId, setCreatedId] = useState<string>();
  async function create() { setError(''); if (!name.trim()) { setError('Give your family a name.'); return; } try { new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(); } catch { setError('Enter a valid timezone, such as Europe/Madrid or America/New_York.'); return; } setBusy(true); try { const id = createdId ?? await createFamily(name.trim(), timezone); setCreatedId(id); await onCreated(id); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  return <Dialog title="Give your stories a home." eyebrow="CREATE YOUR FAMILY" onClose={() => { if (!busy) onClose(); }}><Text style={common.muted}>Start with a name. You can invite the rest of your family next.</Text>{error ? <Notice error text={error} /> : null}<Field label="Family name" value={name} onChangeText={setName} placeholder="What do you call your family?" maxLength={100} editable={!busy && !createdId} /><Field label="Family timezone" value={timezone} onChangeText={setTimezone} placeholder="Europe/Madrid" hint="Weekly contributions start on Monday in this timezone." autoCapitalize="none" editable={!busy && !createdId} /><Button title={createdId ? 'Open your family' : 'Create family'} icon="home-outline" busy={busy} onPress={() => void create()} /></Dialog>;
}
function Logo({ compact = false }: { compact?: boolean }) { return <View style={[common.row, { gap: 8 }]}><Icon name="leaf" size={compact ? 22 : 27} color={colors.olive} /><Text accessibilityRole="header" style={[styles.logo, compact && { fontSize: 29 }]}>welyto</Text><Text style={{ color: colors.terracotta, fontSize: 24 }}>.</Text></View>; }
export default function App() { return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top', 'bottom']}><StatusBar style="dark" /><AppContent /></SafeAreaView></SafeAreaProvider>; }
const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.paper }, sidebar: { width: 252, backgroundColor: colors.surface, padding: 25, paddingTop: 34, borderRightWidth: 1, borderColor: colors.line }, logo: { fontFamily: serif, fontSize: 35, color: colors.ink, letterSpacing: -1.4 }, familySwitch: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }, familyBadge: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }, smallEyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.7, lineHeight: 17, fontWeight: '600' }, familyName: { color: colors.ink, fontSize: 13, fontWeight: '600' }, nav: { gap: 9 }, navItem: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' }, selectedNav: { backgroundColor: colors.pale }, navLabel: { color: colors.muted, fontSize: 14 }, sidebarQuote: { padding: 21, marginTop: 60, backgroundColor: colors.paper, borderRadius: 13, gap: 12 }, quote: { color: colors.olive, fontFamily: serif, fontSize: 20, lineHeight: 28 }, main: { flexGrow: 1, padding: 39, paddingTop: 28 }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 20 }, center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 35, gap: 20 }, mobileHeader: { paddingHorizontal: 21, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, bottomNav: { flexDirection: 'row', padding: 8, gap: 5, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line }, bottomNavItem: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'transparent' }, bottomNavLabel: { color: colors.muted, fontSize: 11 },
});
