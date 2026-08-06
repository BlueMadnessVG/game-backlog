import { motion, useTransform, type MotionStyle } from 'framer-motion';

import styles from './css/FeatureCallouts.module.css';
import { useScrollProgressValue } from '../../store/ScrollProgressContext';
import { featureCallouts, type FeatureCallout } from '../../utils/heroContent';
import { PLATFORM_COLORS } from '../../utils/platformColors';
import { PLATFORM_TIMELINE } from '../../utils/scrollTimeline';

function CalloutItem({ item }: { item: FeatureCallout }) {
  const progress = useScrollProgressValue();
  const [start] = PLATFORM_TIMELINE[item.key];
  const opacity = useTransform(progress, [start, start + 0.05], [0, 1]);
  const color = PLATFORM_COLORS[item.key];

  return (
    <motion.div
      className={styles.item}
      style={{ opacity, '--accent': color } as MotionStyle}
    >
      <span className={styles.tick} />
      <div className={styles.copy}>
        <span className={styles.label}>{item.label}</span>
        <p className={styles.body}>{item.body}</p>
        {item.tag && <span className={styles.tag}>[ {item.tag} ]</span>}
      </div>
    </motion.div>
  );
}

export function FeatureCallouts() {
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {featureCallouts.map((item) => (
          <CalloutItem key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

export default FeatureCallouts;
