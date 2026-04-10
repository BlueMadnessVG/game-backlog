import { motion, useTransform, MotionValue } from 'framer-motion';

import styles from './css/SidebarWave.module.css';

export function WaveLine({
  index,
  total,
  mouseY,
  pulseY,
  pulseProgress,
}: {
  index: number;
  total: number;
  mouseY: MotionValue<number>;
  pulseY: MotionValue<number>;
  pulseProgress: MotionValue<number>;
}) {
  const width = useTransform([mouseY, pulseY, pulseProgress], (input: number[]) => {
    const [latestMouseY, latestPulseY, progress] = input;
    const containerHeight = window.innerHeight;
    const currentLineY = (index / total) * containerHeight;

    // --- 1. MOUNTAIN LOGIC ---
    const distMouse = Math.abs(latestMouseY - currentLineY);
    const mouseRange = 200;
    const mountain = distMouse < mouseRange ? Math.pow(1 - distMouse / mouseRange, 2.5) * 90 : 0;

    // --- 2. SHOCKWAVE LOGIC ---
    const distPulse = Math.abs(latestPulseY - currentLineY);
    const waveFront = progress * 400;
    const waveThickness = 50;
    const distanceToWaveFront = Math.abs(distPulse - waveFront);

    const shockwave =
      distanceToWaveFront < waveThickness
        ? (1 - distanceToWaveFront / waveThickness) * 100 * (1 - progress)
        : 0;

    return 1 + mountain + shockwave;
  });

  return <motion.div style={{ width }} className={styles.wave_line} />;
}
