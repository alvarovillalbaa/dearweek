import { Platform, StyleSheet } from 'react-native';

export const colors = {
  paper: '#F7F4ED', surface: '#FFFEF9', ink: '#29382F', muted: '#657062',
  olive: '#52674C', terracotta: '#AB5E40', line: '#DEE2D5', danger: '#A04438',
  pale: '#EBEEE5', blush: '#F3E6DC', white: '#FFFFFF',
};
export const serif = Platform.select({ web: 'Georgia', ios: 'Georgia', default: 'serif' });
export const common = StyleSheet.create({
  heading: { fontFamily: serif, color: colors.ink, fontSize: 34, lineHeight: 41 },
  subheading: { fontFamily: serif, color: colors.ink, fontSize: 24, lineHeight: 31 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  eyebrow: { color: colors.terracotta, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stack: { gap: 18 },
});
