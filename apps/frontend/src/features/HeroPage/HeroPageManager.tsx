import { useRef } from 'react';

import { HeroScene } from './components/canvas/HeroScene';
import styles from './css/HeroPageManager.module.css';
import { useScrollSync } from './hooks/useScrollSync';

export function HeroPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollSync(pageRef);

  return (
    <div ref={pageRef} className={styles.heroPage}>
      {/* 3D Scene — fixed behind everything */}
      <HeroScene />

      <div className={styles.contentOverlay}></div>
    </div>
  );
}

export default HeroPage;
