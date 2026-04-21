import styles from './css/LibraryGameCardSkeleton.module.css';

function LibraryGameCardSkeleton() {
  return (
    <div className={styles.GameCard_skeleton}>
      <div className={styles.Skeleton_image} />
      <div className={styles.Skeleton_body}>
        <div className={`${styles.Skeleton_text} ${styles.Skeleton_title}`} />
        <div
          className={`${styles.Skeleton_text} ${styles.Skeleton_subtitle}`}
          style={{ animationDelay: '150ms' }}
        />
      </div>
    </div>
  );
}

export default LibraryGameCardSkeleton;
