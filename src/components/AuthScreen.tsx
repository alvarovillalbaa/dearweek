import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { supabase, redirectUrl, emailDeliveryVerified } from '../lib/api';
import { colors, common, serif } from '../theme';
import { Button, Field, Icon, Notice, errorMessage } from './ui';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
const emailDeliveryNotice = 'New accounts are waiting for email delivery. You can sign in with an existing confirmed account. Confirmation and password reset emails are not available yet.';
export function AuthScreen({ recovery, invitation, onRecoveryDone, onInfo }: { recovery: boolean; invitation: boolean; onRecoveryDone: () => void; onInfo: (page: 'privacy' | 'delete-account') => void }) {
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
        setMessage('Check your email to confirm your account, then return to sign in. Your family invitation will stay here until you accept it.');
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
  const title = activeMode === 'signup' ? 'Start something worth keeping.' : activeMode === 'forgot' ? 'Find your way back.' : activeMode === 'reset' ? 'A fresh start.' : 'A little closer, every week.';
  const formTitle = activeMode === 'signup' ? 'Create your account' : activeMode === 'forgot' ? 'Reset your password' : activeMode === 'reset' ? 'Choose a new password' : 'Welcome home';
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, wide && { flexDirection: 'row' }]}>
    <View style={[styles.intro, wide && { width: '52%', padding: 65 }]}><View style={common.row}><View style={styles.logo}><Icon name="leaf" color={colors.olive} size={24} /></View><Text style={styles.brand}>welyto</Text></View><View style={{ gap: 24, marginVertical: wide ? 60 : 30 }}><Text style={common.eyebrow}>THE ORDINARY. THE UNFORGETTABLE.</Text><Text style={[styles.title, !wide && { fontSize: 43, lineHeight: 49 }]}>{title}</Text><Text style={[common.body, { maxWidth: 400, fontSize: 17, lineHeight: 27 }]}>A private home for your family’s stories. One small memory at a time, a lifetime together.</Text></View>
      <View style={styles.keepsake}><View style={styles.paperCard}><Icon name="sunny-outline" size={43} color={colors.terracotta} /><Text style={{ fontFamily: serif, fontSize: 26, color: colors.ink, lineHeight: 34 }}>The little things{`\n`}are the big things.</Text><View style={{ width: 65, height: 2, backgroundColor: colors.terracotta }} /><Text style={common.muted}>MAKE ROOM TO REMEMBER</Text></View><View style={styles.leafCircle}><Icon name="leaf-outline" size={70} color={colors.olive} /></View></View>
      <Text style={[common.muted, { marginTop: 28 }]}>Made for your family. Shared on your terms.</Text>
    </View>
    <View style={[styles.formSide, wide && { width: '48%' }]}><View style={{ width: '100%', maxWidth: 390, gap: 24 }}><Text accessibilityRole="header" style={common.heading}>{formTitle}</Text><Text style={common.muted}>{activeMode === 'signup' ? 'Keep the stories only your family can tell.' : activeMode === 'forgot' ? emailDeliveryVerified ? 'We’ll send a secure link to your email.' : 'Password reset emails are not available yet.' : activeMode === 'reset' ? 'Use at least 10 characters for your new password.' : 'Your family’s next chapter is waiting.'}</Text>
      {!emailDeliveryVerified && activeMode !== 'reset' ? <Notice text={emailDeliveryNotice} /> : null}
      {invitation ? <Notice text="You have a family invitation. Sign in with the email address it was sent to, then accept it." /> : null}
      {error ? <Notice error text={error} /> : null}{message ? <Notice text={message} /> : null}
      {activeMode === 'signup' ? <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" maxLength={80} placeholder="How your family knows you" /> : null}
      {activeMode !== 'reset' ? <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" /> : null}
      {activeMode !== 'forgot' ? <Field label={activeMode === 'reset' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={activeMode === 'login' ? 'current-password' : 'new-password'} onSubmitEditing={() => void submit()} hint={activeMode === 'signup' ? 'At least 10 characters.' : undefined} /> : null}
      <Button title={activeMode === 'signup' ? 'Create account' : activeMode === 'forgot' ? 'Send reset link' : activeMode === 'reset' ? 'Save new password' : 'Sign in'} busy={busy} disabled={mailActionBlocked} onPress={() => void submit()} icon="arrow-forward-outline" />
      {activeMode === 'login' ? <View style={{ gap: 10 }}><Button title="Forgot your password?" onPress={() => change('forgot')} variant="quiet" /><View style={styles.divider} /><Button title="New to Welyto? Create an account" onPress={() => change('signup')} variant="secondary" /><Button title="Resend confirmation email" onPress={() => void resend()} disabled={busy || !emailDeliveryVerified} variant="quiet" small /></View> : activeMode !== 'reset' ? <Button title="Back to sign in" onPress={() => change('login')} variant="quiet" /> : null}
      <View style={[common.row, { justifyContent: 'center' }]}><Button title="Privacy" variant="quiet" small onPress={() => onInfo('privacy')} /><Text style={common.muted}>·</Text><Button title="Delete account" variant="quiet" small onPress={() => onInfo('delete-account')} /></View>
    </View></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: colors.paper }, intro: { padding: 28, backgroundColor: colors.pale, overflow: 'hidden' }, logo: { width: 41, height: 41, borderWidth: 1, borderColor: '#C9D2BF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, brand: { color: colors.ink, fontFamily: serif, fontSize: 35, letterSpacing: -1.5 }, title: { fontFamily: serif, fontSize: 57, lineHeight: 64, color: colors.ink, maxWidth: 460, letterSpacing: -1.5 }, formSide: { padding: 30, justifyContent: 'center', alignItems: 'center', paddingVertical: 58 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 7 }, keepsake: { paddingVertical: 10, alignItems: 'flex-start' }, paperCard: { backgroundColor: colors.surface, padding: 27, width: 285, minHeight: 240, borderRadius: 3, gap: 19, transform: [{ rotate: '-4deg' }], borderWidth: 1, borderColor: '#D4D8C9' }, leafCircle: { position: 'absolute', bottom: -15, left: 220, width: 130, height: 130, borderRadius: 65, backgroundColor: '#D7DFC9', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '25deg' }] },
});
