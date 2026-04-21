import styles from './css/LibrarySkeleton.module.css';
import LibraryGameCardSkeleton from './LibraryGameCardSkeleton';

const SKELETON_COUNT = 12;

function LibrarySkeleton() {
  return (
    <div className={styles.librarySkeleton_grid}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <LibraryGameCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default LibrarySkeleton;
