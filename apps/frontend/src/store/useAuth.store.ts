import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { LoginInput, RegisterInput } from '@repo/shared';

import { setUnauthorizedHandler } from '@/api/api.client';
import { authService, type AuthSession, type AuthUser } from '@/api/auth/auth.service';
import { queryClient } from '@/api/queryClient/queryClient';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * The single owner of "who is signed in". The credential itself is an
 * HttpOnly cookie the browser holds; this store only knows the user it maps to.
 */
interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  /**
   * The user chose "Skip for now" on /accounts, so an empty library shows its
   * empty state instead of sending them back there. In memory only: it resets
   * on reload and on sign-out.
   */
  accountsPromptDismissed: boolean;

  actions: {
    login: (input: LoginInput) => Promise<AuthSession>;
    register: (input: RegisterInput) => Promise<AuthSession>;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
    dismissAccountsPrompt: () => void;
  };
}

/** Collapses concurrent `hydrate()` calls (Root + AuthCallback) into one `/me`. */
let hydrating: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      status: 'loading',
      accountsPromptDismissed: false,

      actions: {
        dismissAccountsPrompt: () => set({ accountsPromptDismissed: true }),

        login: async (input) => {
          const session = await authService.loginWithPassword(input);
          set({ user: session.user, status: 'authenticated' });
          return session;
        },

        register: async (input) => {
          const session = await authService.register(input);
          set({ user: session.user, status: 'authenticated' });
          return session;
        },

        logout: async () => {
          // Sign out locally even if the backend can't be reached.
          await authService.logout().catch(() => undefined);
          endSession();
        },

        hydrate: () => {
          hydrating ??= authService
            .me()
            .then((user) => {
              set(
                user
                  ? { user, status: 'authenticated' }
                  : { user: null, status: 'unauthenticated' },
              );
            })
            .catch((error: unknown) => {
              // Backend unreachable or misbehaving — not a 401. Treat the user
              // as signed out for now, but say why instead of failing silently.
              console.error('[auth] could not restore session', error);
              set({ user: null, status: 'unauthenticated' });
            })
            .finally(() => {
              hydrating = null;
            });
          return hydrating;
        },
      },
    }),
    { name: 'game-backlog-auth' },
  ),
);

/** Drops the user and every cache that belonged to them. */
function endSession(): void {
  useAuthStore.setState({ user: null, status: 'unauthenticated', accountsPromptDismissed: false });
  queryClient.clear();
}

// A 401 on an authenticated session means it expired. The status guard keeps a
// wrong-password 401 on the login form from clearing anything.
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().status === 'authenticated') endSession();
});
