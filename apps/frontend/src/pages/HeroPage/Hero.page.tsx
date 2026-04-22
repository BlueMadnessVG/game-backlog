import { useEffect, useRef } from 'react';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

import styles from './css/Hero.module.css';

import videoFile from '@/assets/images/videoplayback.1775874752697.publer.com.mp4';

export const PortalHero = () => {
  const targetRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // 1. Find the <main> element in the DOM
  // Since Hero is a child of MainLayout, we can look for the closest scrolling parent

  useEffect(() => {
    containerRef.current = document.querySelector('main');
  }, []);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    container: containerRef, // THIS IS THE KEY FIX
    offset: ['start start', 'end end'],
  });

  const opacity = useTransform(scrollYProgress, [0.7, 0.9], [1, 0]);
  const rawScale = useTransform(scrollYProgress, [0, 1], [1, 25]);
  const scale = useSpring(rawScale, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div ref={targetRef} className={styles.portalContainer}>
      <div className={styles.stickyWrapper}>
        <div className={styles.videoLayer}>
          <video src={videoFile} autoPlay muted loop playsInline />
        </div>

        <motion.div
          style={{
            scale,
            opacity,
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            transformOrigin: 'center center', // Addresses the 'non-static' warning
          }}
          className={styles.imageLayer}
        />
      </div>
      <div style={{ height: '100vh' }} />
    </div>
  );
};

export default PortalHero;
