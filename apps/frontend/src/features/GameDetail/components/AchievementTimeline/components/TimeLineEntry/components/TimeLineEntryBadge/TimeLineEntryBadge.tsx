import styles from './css/TimeLineEntryBadge.module.css';

interface TimelineEntryBadgeProps {
  iconUrl: string | null;
  iconGrayUrl: string | null;
  isHidden: boolean;
  isUnlocked: boolean;
}

function TimeLineEntryBadge({
  iconUrl,
  iconGrayUrl,
  isHidden,
  isUnlocked,
}: TimelineEntryBadgeProps) {
  if (isHidden) {
    return (
      <div className={styles.badge_root}>
        <div className={styles.badge_hidden}>
          <span className={styles.badge_hidden_text}>???</span>
        </div>
      </div>
    );
  }

  const src = isUnlocked ? (iconUrl ?? iconGrayUrl) : iconGrayUrl;

  return (
    <div className={styles.badge_root}>
      {src ? (
        <img
          src={src}
          alt=""
          className={styles.badge_image}
          data-unlocked={isUnlocked}
          draggable={false}
        />
      ) : (
        <div className={styles.badge_fallback} />
      )}

      <div className={styles.badge_gradient} />
    </div>
  );
}

export default TimeLineEntryBadge;
