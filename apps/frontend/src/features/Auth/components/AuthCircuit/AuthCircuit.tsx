import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';

import styles from './css/AuthCircuit.module.css';
import { buildAuthCircuit, type AuthCircuitInput, type Rect } from '../../utils/authCircuit';

import { PLATFORM_COLORS } from '@/common/utils/platformColors';

interface AuthCircuitProps {
  /** The page the board covers; its scroll height is the board's height. */
  pageRef: RefObject<HTMLElement | null>;
  /** The auth panel: the "chip" the board is wired around. */
  panelRef: RefObject<HTMLElement | null>;
  /** The assistant cube's dock box (a socket is drawn under the cube). */
  cubeRef: RefObject<HTMLElement | null>;
  /** 0..1: how much of the panel→cube bus is lit (the form's fill level). */
  charge: number;
}

const relative = (el: HTMLElement, origin: DOMRect): Rect | null => {
  const b = el.getBoundingClientRect();
  if (b.width === 0 || b.height === 0) return null;
  return { x: b.left - origin.left, y: b.top - origin.top, w: b.width, h: b.height };
};

/**
 * Circuit-board backdrop for the Auth page, in the HeroPage's materials
 * (dim violet traces, node dots, scanlines) but laid out around the panel:
 * the panel sits in a chip socket, the cube in a smaller one, and a
 * three-line bus between them lights up as the form fills in.
 *
 * Geometry lives in `utils/authCircuit.ts`; this component only measures the
 * page and redraws when something resizes. Purely decorative (aria-hidden,
 * no pointer events).
 */
export function AuthCircuit({ pageRef, panelRef, cubeRef, charge }: AuthCircuitProps) {
  const [layout, setLayout] = useState<AuthCircuitInput | null>(null);

  useEffect(() => {
    const page = pageRef.current;
    const panel = panelRef.current;
    const cube = cubeRef.current;
    if (!page || !panel) return;

    const measure = () => {
      const origin = page.getBoundingClientRect();
      const panelRect = relative(panel, origin);
      if (!panelRect) return;
      setLayout({
        page: { w: page.clientWidth, h: page.scrollHeight },
        panel: panelRect,
        cube: cube ? relative(cube, origin) : null,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    observer.observe(panel);
    if (cube) observer.observe(cube);
    return () => observer.disconnect();
  }, [pageRef, panelRef, cubeRef]);

  const board = useMemo(() => (layout ? buildAuthCircuit(layout) : null), [layout]);

  return (
    <div className={styles.backdrop} aria-hidden>
      {layout && board && (
        <svg
          className={styles.svg}
          width={layout.page.w}
          height={layout.page.h}
          viewBox={`0 0 ${layout.page.w} ${layout.page.h}`}
        >
          {/* Board: edge outline and mounting holes. */}
          <path className={styles.edge} d={board.edge} />
          {board.holes.map(([x, y], i) => (
            <g key={`h${i}`}>
              <circle className={styles.holeRing} cx={x} cy={y} r={6} />
              <circle className={styles.holeDrill} cx={x} cy={y} r={2.5} />
            </g>
          ))}

          {board.traces.map((d, i) => (
            <path key={`t${i}`} className={styles.trace} d={d} />
          ))}

          {/* J1: one pin per platform, its traces feeding the cube from above. */}
          {board.platformTraces.map(({ d, platform }) => (
            <path
              key={`p-${platform}`}
              className={styles.platformTrace}
              d={d}
              style={{ '--platform': PLATFORM_COLORS[platform] } as CSSProperties}
            />
          ))}
          {board.j1 && (
            <g>
              <path className={styles.socket} d={board.j1.housing} />
              {board.j1.pins.map(({ x, y, platform }) => (
                <rect
                  key={platform}
                  className={styles.platformPin}
                  x={x - 4}
                  y={y - 4}
                  width={8}
                  height={8}
                  style={{ '--platform': PLATFORM_COLORS[platform] } as CSSProperties}
                />
              ))}
            </g>
          )}
          {board.sockets.map((d, i) => (
            <path key={`s${i}`} className={styles.socket} d={d} />
          ))}
          {board.bus.map((d, i) => (
            <path key={`b${i}`} className={styles.bus} d={d} />
          ))}
          {board.bus.map((d, i) => (
            <path
              key={`c${i}`}
              className={styles.charge}
              d={d}
              pathLength={1}
              strokeDasharray="1"
              style={{ strokeDashoffset: 1 - charge }}
            />
          ))}
          {board.nodes.map(([x, y], i) => (
            <circle key={`n${i}`} className={styles.node} cx={x} cy={y} r={1.5} />
          ))}

          {/* Silkscreen reference designators. */}
          {board.labels.map(({ text, x, y, anchor }) => (
            <text key={text} className={styles.label} x={x} y={y} textAnchor={anchor}>
              {text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export default AuthCircuit;
