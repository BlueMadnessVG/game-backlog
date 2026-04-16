import type { ReactNode } from 'react';

import { AnimatePresence } from 'framer-motion';

import styles from './css/MainLayout.module.css';
import Sidebar from '../Sidebar/Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <AnimatePresence mode="wait">
      <div className={styles.main_layout}>
        <Sidebar />
        <main>
          {/* We wrap children in a div so padding/max-width works consistently */}
          <div className={styles.content_wrapper}>{children}</div>
        </main>
      </div>
    </AnimatePresence>
  );
};

export default MainLayout;
