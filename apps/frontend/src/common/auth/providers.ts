import { type OAuthProvider } from '@repo/shared';

export interface ProviderMeta {
  label: string;
  isEnabled: boolean;
  brandClass: string;
}

/**
 * Single source of truth for social sign-in buttons. Adding a new platform
 * later means setting `isEnabled: true` (and registering the backend provider
 * + env vars) — nothing else on the UI side changes.
 */
export const AUTH_PROVIDERS: Record<OAuthProvider, ProviderMeta> = {
  google: {
    label: 'Google',
    isEnabled: true,
    brandClass: 'provider_google',
  },
  discord: {
    label: 'Discord',
    isEnabled: false,
    brandClass: 'provider_discord',
  },
};

export const ENABLED_AUTH_PROVIDERS = (
  Object.keys(AUTH_PROVIDERS) as OAuthProvider[]
)
  .filter((id) => AUTH_PROVIDERS[id].isEnabled)
  .map((id) => ({ id, ...AUTH_PROVIDERS[id] }));