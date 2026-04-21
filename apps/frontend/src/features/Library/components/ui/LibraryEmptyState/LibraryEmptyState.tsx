import { Library } from 'lucide-react';

import styles from './css/LibraryEmptyState.module.css';

export function LibraryEmptyState() {
  return (
    <div className={styles.container}>
      <Library className={styles.icon} strokeWidth={1.25} />
      <p className={styles.title}>No games in your library</p>
      <p className={styles.description}>Games you add to your Steam library will appear here.</p>
    </div>
  );
}
