import { User } from 'lucide-react';

import styles from './css/HerpHudChrome.module.css';
import { useScrollStore } from '../../store/heroPageScroll.Store';
import { deriveHudCoordinates, hudChromeContent } from '../../utils/heroContent';

export function HeroHudChrome() {
  const progress = useScrollStore((state) => state.progress);
  const { x, y, z } = deriveHudCoordinates(progress);

  const {
    coreLabel,
    libraries,
    platforms,
    syncStatus,
    latencyMs,
    vramStatus,
    scrollSequenceVersion,
  } = hudChromeContent;

  // Cheap, optional touch: swap the copy once the page has actually moved.
  const scrollLabel = progress < 0.02 ? 'INITIATE SCROLL SEQUENCE' : 'SEQUENCE ACTIVE';

  return (
    <div className={styles.chrome}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.coreLabel}>{coreLabel}</span>
          <span className={styles.statLine}>
            LIBRARIES: {String(libraries).padStart(2, '0')} PLATFORMS:{' '}
            {String(platforms).padStart(2, '0')}
          </span>
        </div>

        <div className={styles.topRight}>
          <div className={styles.syncBadge}>
            <span className={styles.syncDot} />
            SYNC: {syncStatus}
          </div>
          <div className={styles.sysStats}>
            <span>SYS.LATENCY: {latencyMs}MS</span>
            <span>VRAM: {vramStatus}</span>
          </div>
          <div className={styles.avatar}>
            <User size={14} strokeWidth={1.75} />
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <span className={styles.scrollInit}>
          {scrollLabel} {scrollSequenceVersion}
        </span>
        <span className={styles.coords}>
          X: {x} Y: {y} Z: {z}
        </span>
      </div>
    </div>
  );
}

export default HeroHudChrome;
