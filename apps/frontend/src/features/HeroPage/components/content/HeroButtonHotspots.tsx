import { useNavigate } from '@tanstack/react-router';

import styles from './css/HeroButtonHotspots.module.css';
import {
  useButtonHotspotsStore,
  type HeroButtonKey,
} from '../../store/heroButtonHotspots.Store';
import { PLATFORM_COLORS } from '../../utils/platformColors';

/**
 * Viewport-anchored click targets positioned over the (non-interactive) 3D
 * controller face buttons. Positions come from ButtonProjector inside the
 * canvas; hovering drives the 3D glow/depress effect via the store.
 *
 * Exports:
 *  - HeroButtonHotspots: renders one invisible hot spot per face button; each
 *    navigates to /library on click.
 */
const BUTTON_COLORS: Record<HeroButtonKey, string> = {
  square: PLATFORM_COLORS.playstation,
  triangle: PLATFORM_COLORS.xbox,
  cross: PLATFORM_COLORS.steam,
  circle: PLATFORM_COLORS.unified,
};

const BUTTON_ORDER: HeroButtonKey[] = ['square', 'triangle', 'cross', 'circle'];

const BUTTON_LABELS: Record<HeroButtonKey, string> = {
  square: 'PlayStation',
  triangle: 'Xbox',
  cross: 'Steam',
  circle: 'Unified',
};

/**
 * Viewport-anchored click targets positioned over the (non-interactive) 3D
 * controller face buttons. Positions come from ButtonProjector inside the
 * canvas; hovering here drives the 3D glow/depress effect via the store.
 */
export function HeroButtonHotspots() {
  const navigate = useNavigate();
  const hotspots = useButtonHotspotsStore((state) => state.hotspots);
  const glow = useButtonHotspotsStore((state) => state.glow);
  const setGlow = useButtonHotspotsStore((state) => state.setGlow);

  return (
    <div className={styles.hotspots}>
      {BUTTON_ORDER.map((key) => {
        const { x, y, visible } = hotspots[key];
        const accent = BUTTON_COLORS[key];
        const isActive = glow[key];

        return (
          <button
            key={key}
            type="button"
            className={styles.hotspot}
            aria-label={BUTTON_LABELS[key]}
            style={{
              left: x,
              top: y,
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none',
              borderColor: isActive ? accent : 'transparent',
              boxShadow: isActive ? `0 0 18px ${accent}` : 'none',
            }}
            onMouseEnter={() => setGlow(key, true)}
            onMouseLeave={() => setGlow(key, false)}
            onClick={() => navigate({ to: '/library' })}
          >
            <span className={styles.dot} style={{ background: accent }} />
          </button>
        );
      })}
    </div>
  );
}
