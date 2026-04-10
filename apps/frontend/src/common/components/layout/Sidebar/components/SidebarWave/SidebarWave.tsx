import { AnimatePresence, motion, MotionValue } from 'framer-motion';

import styles from './css/SidebarWave.module.css';
import { WaveLine } from './WaveLine';

interface SidebarWaveProps {
  mouseY: MotionValue<number>;
  isVisible: boolean;
  lineCount?: number;
  pulsY: MotionValue<number>;
  pulseProgress: MotionValue<number>;
}

function SidebarWave({
  mouseY,
  isVisible,
  lineCount = 60,
  pulsY,
  pulseProgress,
}: SidebarWaveProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={styles.wave_wrapper}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <WaveLine
              key={i}
              index={i}
              total={lineCount}
              mouseY={mouseY}
              pulseY={pulsY}
              pulseProgress={pulseProgress}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SidebarWave;
