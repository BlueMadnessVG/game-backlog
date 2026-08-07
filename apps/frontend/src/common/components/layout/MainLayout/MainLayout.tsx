import { useRef, type ReactNode } from 'react';

import { useRouterState } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';

import styles from './css/MainLayout.module.css';
import { MainScrollProvider } from './MainScrollContext';
/* import Sidebar from '../Sidebar/Sidebar';
 */
interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const { location } = useRouterState();
  const isGameDetail = location.pathname.startsWith('/games/');
  const mainRef = useRef<HTMLElement>(null);

  return (
    <AnimatePresence mode="wait">
      <MainScrollProvider value={mainRef}>
        <div className={styles.main_layout}>
          {/*           <Sidebar />
           */}{' '}
          <main ref={mainRef} className={isGameDetail ? styles.main_horizontal : undefined}>
            <div className={styles.content_wrapper}>{children}</div>
          </main>
        </div>
      </MainScrollProvider>
    </AnimatePresence>
  );
};

export default MainLayout;
