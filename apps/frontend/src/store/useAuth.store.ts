import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { LoginInput, RegisterInput } from '@repo/shared';

import {
  authService,
  type AuthSession,
  type AuthUser,
} from '@/api/auth/auth.service';
import { clearToken, getToken, setToken as persistToken } from '@/api/auth/token';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;

  actions: {
    setSession: (token: string) => void;
    login: (input: LoginInput) => Promise<AuthSession>;
    register: (input: RegisterInput) => Promise<AuthSession>;
    logout: () => void;
    hydrate: () => Promise<void>;
  };
}

const initialToken = getToken();

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      token: initialToken,
      user: null,
      status: initialToken ? 'loading' : 'unauthenticated',

      actions: {
        setSession: (token) => {
          persistToken(token);
          set({ token, status: 'authenticated' });
        },

        login: async (input) => {
          const session = await authService.loginWithPassword(input);
          persistToken(session.token);
          set({ token: session.token, user: session.user, status: 'authenticated' });
          return session;
        },

        register: async (input) => {
          const session = await authService.register(input);
          persistToken(session.token);
          set({ token: session.token, user: session.user, status: 'authenticated' });
          return session;
        },

        logout: () => {
          clearToken();
          set({ token: null, user: null, status: 'unauthenticated' });
        },

        hydrate: async () => {
          if (!getToken()) {
            set({ status: 'unauthenticated' });
            return;
          }

          set({ status: 'loading' });

          const user = get().user ?? (await authService.me());

          if (user) {
            set({ user, status: 'authenticated' });
          } else {
            clearToken();
            set({ token: null, user: null, status: 'unauthenticated' });
          }
        },
      },
    }),
    { name: 'game-backlog-auth' },
  ),
);
