import styles from './css/GameCardPlatformTag.module.css';

import type { PercentageRank } from '../utils/getPercentageRank';

import { PlatformIcon } from '@/common/components/ui/Icons/PlatformIcons';

interface GameCardPlatformTagProps {
  platform: string;
  rank: PercentageRank;
}

function GameCardPlatformTag({ platform, rank }: GameCardPlatformTagProps) {
  return (
    <div className={styles.platform_tag} data-rank={rank}>
      <PlatformIcon platform={platform} className={styles.platform_icon} />
      <span className={styles.platform_label}>{platform}</span>
    </div>
  );
}

export default GameCardPlatformTag;
