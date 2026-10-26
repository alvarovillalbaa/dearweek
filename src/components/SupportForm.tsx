import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, common } from '../theme';
import { Button, Field, Notice } from './ui';

export const SUPPORT_EMAIL = 'alvaro.villalbaperez@icloud.com';
type Form = { name: string; email: string; topic: string; message: string };
type Errors = Partial<Record<keyof Form, string>>;

export function SupportForm() {
  const [form, setForm] = useState<Form>({ name: '', email: '', topic: '', message: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [launchError, setLaunchError] = useState(false);
  const [draftRequested, setDraftRequested] = useState(false);
  const subject = `Dearweek support: ${form.topic.trim()}`;
  const body = [
    ...(form.name.trim() ? [`Name: ${form.name.trim()}`] : []),
    `Please reply to: ${form.email.trim()}`,
    '',
    form.message.trim(),
  ].join('\n');
  const draft = `To: ${SUPPORT_EMAIL}\nSubject: ${subject}\n\n${body}`;

  function change(field: keyof Form, value: string) {
    setForm(previous => ({ ...previous, [field]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[field]; return next; });
    setLaunchError(false); setDraftRequested(false); setShowDraft(false);
  }

  async function openDraft() {
    if (busy) return;
    const next: Errors = {};
    if (form.name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(form.name)) next.name = 'Use one line, up to 80 characters.';
    if (form.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter an email address where you can receive a reply.';
    if (!form.topic.trim() || form.topic.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(form.topic)) next.topic = 'Add a short topic, up to 100 characters.';
    if (form.message.trim().length < 10 || form.message.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(form.message)) next.message = 'Add 10–2,000 characters about what you need help with.';
    setErrors(next); setLaunchError(false); setDraftRequested(false);
    if (Object.keys(next).length) { setShowDraft(false); return; }
    setBusy(true); setShowDraft(true);
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      setDraftRequested(true);
    } catch {
      setLaunchError(true);
    } finally {
      setBusy(false);
    }
  }

  return <View style={styles.form}>
    <Text style={common.body}>Questions about your account, family sharing or privacy? Prepare a message below.</Text>
    <View style={styles.address}>
      <Text style={common.muted}>Email support</Text>
      <Text selectable style={[common.body, styles.email]}>{SUPPORT_EMAIL}</Text>
    </View>
    <Notice text="This opens a draft in your email app. Review it and choose Send there. This form does not send or save your message." />
    {Object.values(errors).some(Boolean) ? <Notice error text="Check the highlighted fields before opening your draft." /> : null}
    <Field label="Your name (optional)" value={form.name} onChangeText={value => change('name', value)} autoComplete="name" maxLength={80} editable={!busy} error={errors.name} />
    <Field label="Email for a reply" value={form.email} onChangeText={value => change('email', value)} autoComplete="email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={254} editable={!busy} placeholder="you@example.com" error={errors.email} />
    <Field label="Topic" value={form.topic} onChangeText={value => change('topic', value)} maxLength={100} editable={!busy} placeholder="Account access, family sharing, photos…" error={errors.topic} />
    <Field label="How can we help?" value={form.message} onChangeText={value => change('message', value)} multiline maxLength={2000} editable={!busy} placeholder="What were you trying to do, and what happened?" hint={`${form.message.length}/2,000 characters. Leave out passwords, sign-in links and private family stories.`} error={errors.message} />
    <Button title="Open email draft" onPress={() => void openDraft()} busy={busy} icon="mail-outline" />
    {launchError ? <Notice error text="Your email app could not be opened. Email the address above and paste the draft below." /> : null}
    {draftRequested ? <Notice text="Review and send the draft in your email app. If it did not open, you can copy the draft below instead." /> : null}
    {showDraft ? <View style={styles.fallback}>
      <Text accessibilityRole="header" style={common.subheading}>Your email draft</Text>
      <Text style={common.muted}>Select the text to copy it into any email app.</Text>
      <Text selectable style={[common.body, styles.draft]}>{draft}</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  form: { gap: 20 }, address: { gap: 4 }, email: { fontWeight: '600', flexShrink: 1 },
  fallback: { gap: 10, marginTop: 4 }, draft: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 21 },
});
