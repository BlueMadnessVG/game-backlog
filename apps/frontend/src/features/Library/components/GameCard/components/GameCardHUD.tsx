import { motion } from 'framer-motion';

import styles from './css/GameCard.module.css';
import { GameCardMetadata } from './GameCardMetadata';

interface GameCardHUDProps {
  title: string;
  percentage: number;
  playtime: number;
  platform: string;
}

function GameCardHUD({ title, percentage, playtime, platform }: GameCardHUDProps) {
  return (
    <div className={styles.hud_overlay}>
      <motion.div
        className={styles.corner_percentage}
        whileHover={{ scale: 1.1, borderColor: '#00ffff' }}
      >
        {Math.round(percentage)}%
      </motion.div>

      <GameCardMetadata title={title} playTime={playtime} platform={platform} />
    </div>
  );
}

export default GameCardHUD;
