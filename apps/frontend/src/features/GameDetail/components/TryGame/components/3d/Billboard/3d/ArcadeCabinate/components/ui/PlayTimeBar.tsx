import styles from './css/PlayTimeBar.module.css';

export const PlayTimeBar: React.FC<{ hours: number }> = ({ hours }) => {
  const MAX_BLOCKS = 10;
  const filled = Math.min(Math.round(hours / 10), MAX_BLOCKS);

  return (
    <div>
      <div className={styles.playTimeBlocks}>
        {Array.from({ length: MAX_BLOCKS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.timeBlock} ${i < filled ? styles.blockActive : styles.blockDim}`}
          />
        ))}
      </div>
      <span className={styles.hoursText}>{hours} hrs</span>
    </div>
  );
};
