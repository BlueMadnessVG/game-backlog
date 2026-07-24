/* import { useEffect, useRef } from 'react';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion'; */

import HeroPageManager from '@/features/HeroPage/HeroPageManager';

export const PortalHero = () => {
  /*   const targetRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null); */

  // 1. Find the <main> element in the DOM
  // Since Hero is a child of MainLayout, we can look for the closest scrolling parent

  /*   useEffect(() => {
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
  }); */

  return <HeroPageManager />;
};

export default PortalHero;
