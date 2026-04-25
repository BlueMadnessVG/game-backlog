import type { ReactNode } from 'react';

import styles from './css/LibraryGrid.module.css';

interface LibraryGridProps {
  children: ReactNode;
}

function LibraryGrid({ children }: LibraryGridProps) {
  return (
    <section className={styles.grid_container} aria-label="Game Library Grid">
      {children}
    </section>
  );
}

export default LibraryGrid;
