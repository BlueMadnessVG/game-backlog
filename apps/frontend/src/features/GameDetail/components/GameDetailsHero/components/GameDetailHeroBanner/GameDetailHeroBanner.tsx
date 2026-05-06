import { type RefObject } from 'react';

import { motion, useScroll, useTransform } from 'framer-motion';

import styles from './css/GameDetailHeroBanner.module.css';

interface GameDetailHeroBannerProps {
  src: string | null;
  title: string;
  scrollRef: RefObject<HTMLDivElement>;
}

const MOCK_BANNER =
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_hero.jpg';

function GameDetailHeroBanner({ src, title, scrollRef }: GameDetailHeroBannerProps) {
  const { scrollXProgress } = useScroll({
    container: scrollRef,
  });

  const x = useTransform(scrollXProgress, [0, 1], ['0%', '-30%']);

  const bannerSrc = src ?? MOCK_BANNER;

  return (
    <div className={styles.banner_root}>
      <motion.div className={styles.banner_image_wrap} style={{ x }}>
        <img
          src={bannerSrc}
          alt={`${title} banner`}
          className={styles.banner_image}
          draggable={false}
        />
      </motion.div>

      <div className={styles.banner_gradient_bottom} />
      <div className={styles.banner_gradient_sides} />
      <div className={styles.banner_scanline_overlay} />
    </div>
  );
}

export default GameDetailHeroBanner;
