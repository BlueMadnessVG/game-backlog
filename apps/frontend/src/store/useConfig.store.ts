import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface ConfigState {
  // UI States
  sidebarLocked: boolean;
  compactMode: boolean;

  // Preferences
  theme: 'dark' | 'light' | 'amoled';
  language: 'en' | 'es';
}

interface ConfigActions {
  actions: {
    setSidebarLocked: (locked: boolean) => void;
    toggleSidebarLocked: () => void;
    setCompactMode: (enabled: boolean) => void;
    setTheme: (theme: 'dark' | 'light' | 'amoled') => void;
  };
}

const initialState: ConfigState = {
  sidebarLocked: false,
  compactMode: false,
  theme: 'dark',
  language: 'en',
};

export const useConfigStore = create<ConfigState & ConfigActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        actions: {
          setSidebarLocked: (locked) => set({ sidebarLocked: locked }),

          toggleSidebarLocked: () => set((state) => ({ sidebarLocked: !state.sidebarLocked })),

          setCompactMode: (enabled) => set({ compactMode: enabled }),

          setTheme: (theme) => set({ theme }),
        },
      }),
      {
        name: 'command-center-config',
        partialize: (state) => {
          const { actions: _actions, ...rest } = state;
          return rest;
        },
      },
    ),
  ),
);

export const useConfigActions = () => useConfigStore((state) => state.actions);
