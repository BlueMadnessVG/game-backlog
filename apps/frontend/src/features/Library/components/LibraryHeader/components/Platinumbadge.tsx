import { Hexagon, Star } from 'lucide-react';

import styles from './css/Platinumbadge.module.css';

interface PlatinumBadgeProps {
  size?: number;
}

const STAR_TO_HEXAGON_RATIO = 0.45;

export function PlatinumBadge({ size = 28 }: PlatinumBadgeProps) {
  return (
    <span className={styles.badge} style={{ width: size, height: size }} aria-hidden="true">
      <Hexagon size={size} strokeWidth={1.5} />
      <Star
        size={size * STAR_TO_HEXAGON_RATIO}
        strokeWidth={1.5}
        fill="currentColor"
        className={styles.star}
      />
    </span>
  );
}
