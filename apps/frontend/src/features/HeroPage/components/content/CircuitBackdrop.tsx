import styles from './css/CircuitBackdrop.module.css';
import { pageProgress, useProgressNumber } from '../../timeline';

/**
 * Motherboard-style backdrop behind the whole page: a circuit frame along the
 * viewport edges with short branch traces, node dots and faint scanlines.
 *
 * The frame's bright "charge" trace fills in with page scroll progress, so it
 * completes the loop as you reach the end of the page. Purely decorative
 * (aria-hidden, no pointer events).
 *
 * Exports:
 *  - CircuitBackdrop (default export too).
 */
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

/** Chip socket in the centre of the board — the cube sits on it. */
const SOCKET_PATH = 'M 42 34 H 60 V 64 L 58 66 H 40 V 36 Z';

const SOCKET_PINS = [
  ...[44, 48, 52, 56].map((x) => `M ${x} 34 V 31`),
  ...[44, 48, 52, 56].map((x) => `M ${x} 66 V 69`),
  ...[42, 50, 58].map((y) => `M 40 ${y} H 37`),
  ...[42, 50, 58].map((y) => `M 60 ${y} H 63`),
];

/** Traces that continue the edge stubs inward to the socket pins. */
const INNER_TRACES = [
  // top
  'M 20 7 V 16 L 30 26 H 38',
  'M 45 7 V 22 L 48 25 V 31',
  'M 62 7 V 18 L 56 24 V 31',
  // right
  'M 93 36 H 80 L 74 42 H 63',
  'M 93 58 H 63',
  'M 86 82 H 72 L 64 74 H 56 V 69',
  // bottom
  'M 32 90 V 80 L 44 74 V 69',
  'M 62 92 V 80 L 52 74 V 69',
  'M 8 90 V 78 L 20 66 H 30',
  // left
  'M 5 52 H 18 L 24 58 H 37',
  'M 5 30 H 14 L 26 42 H 37',
  'M 12 64 H 24 L 30 50 H 37',
];

/** Parallel three-line buses for board texture (hidden on narrow screens). */
const BUS_PATHS = [
  'M 70 12 H 88 L 92 16',
  'M 70 14 H 87 L 91 18',
  'M 70 16 H 86 L 90 20',
  'M 14 80 H 26',
  'M 14 82 H 26',
  'M 14 84 H 26',
];

const INNER_NODES: [number, number][] = [
  [0.3, 0.26],
  [0.38, 0.26],
  [0.48, 0.25],
  [0.56, 0.24],
  [0.8, 0.36],
  [0.74, 0.42],
  [0.72, 0.82],
  [0.64, 0.74],
  [0.44, 0.74],
  [0.52, 0.74],
  [0.2, 0.66],
  [0.3, 0.66],
  [0.18, 0.52],
  [0.24, 0.58],
  [0.14, 0.3],
  [0.26, 0.42],
  [0.24, 0.64],
  [0.3, 0.5],
  [0.88, 0.12],
  [0.26, 0.82],
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

export function CircuitBackdrop() {
  const progress = useProgressNumber(pageProgress);

  return (
    <div className={styles.backdrop} aria-hidden>
      <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
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
        {INNER_TRACES.map((d) => (
          <path key={d} className={styles.traceDim} d={d} />
        ))}
        {BUS_PATHS.map((d) => (
          <path key={d} className={`${styles.traceDim} ${styles.bus}`} d={d} />
        ))}
        <path className={styles.socket} d={SOCKET_PATH} />
        {SOCKET_PINS.map((d) => (
          <path key={d} className={styles.socket} d={d} />
        ))}
      </svg>
      {[...CIRCUIT_NODES, ...INNER_NODES].map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          className={styles.node}
          style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
        />
      ))}
    </div>
  );
}

export default CircuitBackdrop;
