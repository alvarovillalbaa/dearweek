// Public application settings only. This module is shared by the Expo client and
// Edge Functions; never add secret keys, server imports or provider side effects.
export const publicProject: Readonly<{
  url: string;
  publishableKey: string;
  siteUrl: string;
  emailDeliveryVerified: boolean;
}> = Object.freeze({
  url: 'https://faftywddybmgamvseibe.supabase.co',
  publishableKey: 'sb_publishable_DSWjakNpbunPZG3puPhtDw_GZ5ojSoh',
  siteUrl: 'https://dearweek.vercel.app',
  emailDeliveryVerified: false,
});
