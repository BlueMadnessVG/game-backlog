import type { ReactNode } from 'react';

import { useRouterState } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';

import styles from './css/MainLayout.module.css';
import Sidebar from '../Sidebar/Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const { location } = useRouterState();
  const isGameDetail = location.pathname.startsWith('/games/');

  return (
    <AnimatePresence mode="wait">
      <div className={styles.main_layout}>
        <Sidebar />
        <main className={isGameDetail ? styles.main_horizontal : undefined}>
          <div className={styles.content_wrapper}>{children}</div>
        </main>
      </div>
    </AnimatePresence>
  );
};

export default MainLayout;
