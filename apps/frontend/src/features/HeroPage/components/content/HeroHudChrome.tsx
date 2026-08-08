import { Gamepad2 } from 'lucide-react';

import styles from './css/HeroHudChrome.module.css';
import { useScrollStore } from '../../store/heroPageScroll.Store';
const FRAME_PATH =
  'M 1 2 H 76 L 82 8 H 99 V 58 L 94 64 V 98 H 24 L 18 92 H 1 V 36 L 5 30 V 2';

const BRANCH_PATHS = [
  'M 20 2 V 7',
  'M 45 2 V 7',
  'M 62 2 V 7',
  'M 99 48 V 42 L 93 36',
  'M 99 70 V 64 L 93 58',
  'M 94 82 L 86 82',
  'M 8 98 V 90',
  'M 32 98 V 90',
  'M 56 98 V 92 L 62 92',
  'M 78 98 V 92',
  'M 1 52 L 5 52',
];

const CIRCUIT_NODES: [number, number][] = [
  [0.76, 0.02],
  [0.82, 0.08],
  [0.99, 0.58],
  [0.94, 0.64],
  [0.24, 0.98],
  [0.18, 0.92],
  [0.01, 0.36],
  [0.05, 0.3],
  [0.2, 0.07],
  [0.45, 0.07],
  [0.62, 0.07],
  [0.93, 0.36],
  [0.93, 0.58],
  [0.86, 0.82],
  [0.08, 0.9],
  [0.32, 0.9],
  [0.62, 0.92],
  [0.78, 0.92],
  [0.3, 0.02],
  [0.55, 0.02],
  [0.99, 0.25],
  [0.99, 0.85],
  [0.45, 0.98],
  [0.7, 0.98],
  [0.01, 0.7],
  [0.05, 0.52],
];

export function HeroHudChrome() {
  const progress = useScrollStore((state) => state.progress);
  const showPrompt = progress < 0.04;

  return (
    <div className={styles.chrome}>
      <div className={styles.circuit} aria-hidden>
        <svg className={styles.circuitSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className={styles.traceDim} d={FRAME_PATH} />
          <path
            className={styles.traceCharge}
            d={FRAME_PATH}
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
          />
          {BRANCH_PATHS.map((d) => (
            <path key={d} className={styles.traceDim} d={d} />
          ))}
        </svg>
        {CIRCUIT_NODES.map(([left, top]) => (
          <span
            key={`${left}-${top}`}
            className={styles.circuitNode}
            style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
          />
        ))}
      </div>

      <div className={styles.topBar}>
        <div className={styles.panel}>
          <div className={styles.panelInner}>
            <Gamepad2 size={14} strokeWidth={1.75} />
            <span>BACKLOG</span>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={`${styles.panel}${showPrompt ? '' : ` ${styles.panelFade}`}`}>
          <div className={styles.panelInner}>
            <span className={styles.promptArrow}>▼</span>
            <span>SCROLL TO EXPLORE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroHudChrome;
