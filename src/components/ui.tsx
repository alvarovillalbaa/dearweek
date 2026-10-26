import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, common, serif } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}
export function Button({ title, onPress, variant = 'primary', disabled, busy, icon, small = false }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; busy?: boolean; icon?: IconName; small?: boolean;
}) {
  const foreground = variant === 'primary' || variant === 'danger' ? colors.white : colors.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed, focused }: any) => [styles.button, small && styles.small, variant === 'primary' && styles.primary, variant === 'danger' && styles.danger, variant === 'quiet' && styles.quiet, (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.8 }, focused && styles.focus]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} color={foreground} size={small ? 16 : 18} /> : null}
    <Text style={{ color: foreground, fontSize: small ? 12 : 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{title}</Text>
  </Pressable>;
}
export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#7D857B" style={[styles.input, props.multiline && styles.multiline, props.style]} />
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
export function Notice({ text, error = false, action, onAction }: { text: string; error?: boolean; action?: string; onAction?: () => void }) {
  return <View accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.notice, error && styles.errorNotice]}>
    <Icon name={error ? 'alert-circle-outline' : 'information-circle-outline'} color={error ? colors.danger : colors.olive} />
    <Text style={[common.muted, { flex: 1, color: error ? colors.danger : colors.ink }]}>{text}</Text>
    {action && onAction ? <Button title={action} onPress={onAction} variant="quiet" small /> : null}
  </View>;
}
export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected: active } : undefined} onPress={onPress} disabled={!onPress}
    style={({ pressed, focused }: any) => [styles.pill, active && styles.activePill, pressed && { opacity: 0.7 }, focused && styles.focus]}>
    <Text style={{ color: active ? colors.white : colors.olive, fontSize: 12, fontWeight: '500' }}>{label}</Text>
  </Pressable>;
}
export function Dialog({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View accessibilityViewIsModal style={[styles.dialog, wide && { maxWidth: 860 }]}>
        <View style={styles.dialogHeader}><View style={{ flex: 1, gap: 5 }}>{eyebrow ? <Text style={common.eyebrow}>{eyebrow}</Text> : null}<Text accessibilityRole="header" style={common.subheading}>{title}</Text></View><Button title="Close" variant="quiet" onPress={onClose} icon="close-outline" small /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
export function EmptyState({ title, description, action, onAction, icon = 'leaf-outline' }: { title: string; description: string; action?: string; onAction?: () => void; icon?: IconName }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Icon name={icon} size={30} color={colors.olive} /></View><Text style={[common.subheading, { textAlign: 'center' }]}>{title}</Text><Text style={[common.muted, { textAlign: 'center', maxWidth: 390 }]}>{description}</Text>{action && onAction ? <Button title={action} onPress={onAction} icon="add-outline" /> : null}</View>;
}
export function Confirmation({ title, description, confirmLabel, busy, onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <View style={styles.confirm}><Text style={[common.body, { fontWeight: '700' }]}>{title}</Text><Text style={common.muted}>{description}</Text><View style={common.row}><Button title={confirmLabel} variant="danger" onPress={onConfirm} busy={busy} /><Button title="Cancel" variant="secondary" onPress={onCancel} disabled={busy} /></View></View>;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 17, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', flexShrink: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface },
  small: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 8 }, primary: { backgroundColor: colors.olive, borderColor: colors.olive }, danger: { backgroundColor: colors.danger, borderColor: colors.danger }, quiet: { backgroundColor: 'transparent', borderColor: 'transparent' }, focus: { borderColor: colors.terracotta, borderWidth: 2 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' }, input: { backgroundColor: colors.surface, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, minHeight: 48 }, multiline: { minHeight: 145, textAlignVertical: 'top', lineHeight: 24 }, hint: { fontSize: 12, color: colors.muted, lineHeight: 18 }, error: { color: colors.danger, fontSize: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.pale, padding: 14, borderRadius: 12 }, errorNotice: { backgroundColor: '#FAEBE6' }, pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.pale, borderWidth: 1, borderColor: 'transparent' }, activePill: { backgroundColor: colors.olive },
  overlay: { flex: 1, backgroundColor: 'rgba(28,40,31,0.36)', padding: 18, justifyContent: 'center', alignItems: 'center' }, dialog: { width: '100%', maxWidth: 620, maxHeight: '94%', backgroundColor: colors.paper, borderRadius: 23, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }, dialogHeader: { padding: 23, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, dialogContent: { padding: 23, gap: 20 },
  empty: { paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 20 }, emptyIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, confirm: { backgroundColor: colors.blush, borderRadius: 14, padding: 18, gap: 12 },
});
