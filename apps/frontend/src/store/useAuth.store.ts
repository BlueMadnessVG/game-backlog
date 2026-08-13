import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { authService, type AuthUser } from '@/api/auth/auth.service';
import { clearToken, getToken, setToken as persistToken } from '@/api/auth/token';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;

  actions: {
    setSession: (token: string) => void;
    logout: () => void;
    hydrate: () => Promise<void>;
  };
}

const initialToken = getToken();

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      token: initialToken,
      user: null,
      status: initialToken ? 'loading' : 'unauthenticated',

      actions: {
        setSession: (token) => {
          persistToken(token);
          set({ token, status: 'authenticated' });
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

          const user = await authService.me();

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
