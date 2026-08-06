import { createContext, useContext, type ReactNode, type RefObject } from 'react';

const MainScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function MainScrollProvider({
  value,
  children,
}: {
  value: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return <MainScrollContext.Provider value={value}>{children}</MainScrollContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMainScroll(): RefObject<HTMLElement | null> {
  const context = useContext(MainScrollContext);
  if (!context) {
    throw new Error('useMainScroll must be used within a MainScrollProvider');
  }
  return context;
}
