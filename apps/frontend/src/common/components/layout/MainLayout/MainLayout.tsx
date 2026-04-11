import type { ReactNode } from 'react';

import styles from './css/MainLayout.module.css';
import Sidebar from '../Sidebar/Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className={styles.main_layout}>
      <Sidebar />
      <main>
        {/* We wrap children in a div so padding/max-width works consistently */}
        <div className={styles.content_wrapper}>{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
