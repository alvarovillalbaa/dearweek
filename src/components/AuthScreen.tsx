import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { supabase, redirectUrl, emailDeliveryVerified } from '../lib/api';
import { colors, common, serif } from '../theme';
import { Button, Field, Icon, Notice, errorMessage } from './ui';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
const emailDeliveryNotice = 'New accounts and password reset emails are not available yet. You can still sign in with an existing confirmed account. Contact support if you need a hand.';
export function AuthScreen({ recovery, invitation, onRecoveryDone, onInfo }: { recovery: boolean; invitation: boolean; onRecoveryDone: () => void; onInfo: (page: 'privacy' | 'delete-account' | 'contact') => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const activeMode = recovery ? 'reset' : mode;
  const mailActionBlocked = !emailDeliveryVerified && (activeMode === 'signup' || activeMode === 'forgot');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const { width } = useWindowDimensions(); const wide = width >= 900;
  function change(next: Mode) { setMode(next); setError(''); setMessage(''); setPassword(''); }
  async function submit() {
    if (!supabase) return; setError(''); setMessage('');
    if (mailActionBlocked) { setError(emailDeliveryNotice); return; }
    if (activeMode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if ((activeMode === 'signup' || activeMode === 'reset') && password.length < 10) { setError('Choose a password with at least 10 characters.'); return; }
    if (activeMode === 'login' && !password) { setError('Enter your password.'); return; }
    setBusy(true);
    try {
      if (activeMode === 'signup') {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl(), data: { display_name: name.trim() || email.split('@')[0] } } });
        if (result.error) throw result.error;
        setMessage(invitation ? 'Check your email to confirm your account, then sign in here to accept your family invitation.' : 'Check your email to confirm your account, then return to sign in.');
        setPassword('');
      } else if (activeMode === 'login') {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (result.error) throw result.error;
      } else if (activeMode === 'forgot') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() }); if (result.error) throw result.error;
        setMessage('If an account exists for this email, a password reset link is on its way. Open it on this device to continue.');
      } else {
        const result = await supabase.auth.updateUser({ password }); if (result.error) throw result.error;
        setPassword(''); onRecoveryDone();
      }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function resend() {
    if (!emailDeliveryVerified) { setError(emailDeliveryNotice); return; }
    if (!supabase || !email.trim()) { setError('Enter your email address first.'); return; }
    setBusy(true); setError('');
    try { const result = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl() } }); if (result.error) throw result.error; setMessage('Confirmation email requested. Please check your inbox and spam folder.'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const showEmailGate = !emailDeliveryVerified && activeMode !== 'reset';
  const formTitle = activeMode === 'signup' ? 'Create your account' : activeMode === 'forgot' ? 'Reset your password' : activeMode === 'reset' ? 'Choose a new password' : 'Sign in to Dearweek';
  const description = activeMode === 'signup' ? emailDeliveryVerified ? 'Start with your email, then invite your family.' : 'Account creation will open once confirmation email is ready.'
    : activeMode === 'forgot' ? emailDeliveryVerified ? 'Enter your account email to request a secure reset link.' : 'Email resets are paused. Contact support for help with account access.'
    : activeMode === 'reset' ? 'Use at least 10 characters for your new password.' : 'Your family’s stories, together in one place.';
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, wide && styles.widePage]}>
    <View style={[styles.intro, wide && styles.wideIntro]}>
      <View style={styles.brandRow}><View style={styles.logo}><Icon name="leaf-outline" color={colors.olive} size={24} /></View><Text style={styles.brand}>Dearweek</Text></View>
      <View style={[styles.story, wide && { marginVertical: 48 }]}>
        <Text style={common.eyebrow}>A SMALL FAMILY RITUAL</Text>
        <Text style={[styles.title, !wide && styles.mobileTitle]}>Keep a little{`\n`}of this week.</Text>
        <Text style={[common.body, styles.introBody]}>Add one memory from your week. Invite your family to add theirs, and keep the little details close.</Text>
      </View>
      {wide ? <View style={styles.keepsake}>
        <View style={common.row}><Icon name="calendar-outline" color={colors.terracotta} size={21} /><Text style={common.eyebrow}>A QUESTION FOR THIS WEEK</Text></View>
        <Text style={styles.prompt}>What would you like to remember from this week?</Text>
        <Text style={common.muted}>A sentence is enough to begin.</Text>
      </View> : null}
      <View style={styles.sharing}><Icon name="lock-closed-outline" size={15} color={colors.olive} /><Text style={[common.muted, { flex: 1 }]}>Family, private or selected people. You choose.</Text></View>
    </View>
    <View style={[styles.formSide, wide && styles.wideFormSide]}><View style={styles.form}>
      <Text accessibilityRole="header" style={common.heading}>{formTitle}</Text><Text style={common.muted}>{description}</Text>
      {showEmailGate ? <View style={{ gap: 10 }}><Notice text={emailDeliveryNotice} /><Button title="Contact support" variant="secondary" onPress={() => onInfo('contact')} disabled={busy} icon="mail-outline" /></View> : null}
      {invitation ? <Notice text="You have a family invitation. Sign in with the email address it was sent to, then accept it." /> : null}
      {error ? <Notice error text={error} /> : null}{message ? <Notice text={message} /> : null}
      {activeMode === 'signup' ? <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" maxLength={80} placeholder="How your family knows you" /> : null}
      {activeMode !== 'reset' ? <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" /> : null}
      {activeMode !== 'forgot' ? <Field label={activeMode === 'reset' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={activeMode === 'login' ? 'current-password' : 'new-password'} onSubmitEditing={() => void submit()} hint={activeMode === 'signup' ? 'At least 10 characters.' : undefined} /> : null}
      <Button title={activeMode === 'signup' ? 'Create account' : activeMode === 'forgot' ? 'Send reset link' : activeMode === 'reset' ? 'Save new password' : 'Sign in'} busy={busy} disabled={mailActionBlocked} onPress={() => void submit()} icon="arrow-forward-outline" />
      {activeMode === 'login' ? <View style={{ gap: 10 }}><Button title="Forgot your password?" onPress={() => change('forgot')} variant="quiet" /><View style={styles.divider} /><Button title={emailDeliveryVerified ? 'Create an account' : 'About new accounts'} onPress={() => change('signup')} variant="secondary" /><Button title="Resend confirmation email" onPress={() => void resend()} disabled={busy || !emailDeliveryVerified} variant="quiet" /></View> : activeMode !== 'reset' ? <Button title="Back to sign in" onPress={() => change('login')} variant="quiet" /> : null}
      <View style={[common.row, { justifyContent: 'center' }]}><Button title="Privacy" variant="quiet" onPress={() => onInfo('privacy')} /><Button title="Delete account" variant="quiet" onPress={() => onInfo('delete-account')} />{!showEmailGate ? <Button title="Contact support" variant="quiet" onPress={() => onInfo('contact')} /> : null}</View>
    </View></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: colors.paper }, widePage: { flexDirection: 'row' },
  intro: { padding: 24, backgroundColor: colors.pale }, wideIntro: { width: '52%', padding: 56 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, flexShrink: 0, borderWidth: 1, borderColor: '#C9D2BF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.ink, fontFamily: serif, fontSize: 34, lineHeight: 42, letterSpacing: -1.2, flexShrink: 1 },
  story: { gap: 18, marginVertical: 24 }, title: { fontFamily: serif, fontSize: 56, lineHeight: 63, color: colors.ink, maxWidth: 460, letterSpacing: -1.5 },
  mobileTitle: { fontSize: 39, lineHeight: 45, letterSpacing: -1 }, introBody: { maxWidth: 420, fontSize: 16, lineHeight: 25 },
  keepsake: { padding: 24, width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: '#D4D8C9', gap: 18 },
  prompt: { fontFamily: serif, fontSize: 29, lineHeight: 37, color: colors.ink }, sharing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  formSide: { padding: 24, paddingVertical: 36, justifyContent: 'center', alignItems: 'center' }, wideFormSide: { width: '48%', paddingVertical: 56 },
  form: { width: '100%', maxWidth: 400, gap: 20 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 7 },
});
