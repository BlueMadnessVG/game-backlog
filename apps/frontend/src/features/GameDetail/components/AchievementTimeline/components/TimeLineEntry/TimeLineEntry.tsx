import { motion } from 'framer-motion';

import TimeLineEntryBadge from './components/TimeLineEntryBadge/TimeLineEntryBadge';
import TimeLineEntryContent from './components/TimeLineEntryContent/TimeLineEntryContent';
import styles from './css/TimeLineEntry.module.css';

import type { Achievement } from '@repo/shared';

import { useInteractionObserver } from '@/common/hooks/useInteractionObserver/useInteractionObserver';

interface TimeLineEntryProps {
  achievement: Achievement;
  index: number;
}

const entryVariants = {
  hidden: { opacity: 1, x: 60 },
  visible: { opacity: 1, x: 0 },
};

function TimeLineEntry({ achievement, index }: TimeLineEntryProps) {
  const { targetRef, isInteracting } = useInteractionObserver<HTMLDivElement>({
    threshold: 0.15,
    triggerOnce: true,
    rootMargin: '0px 100px 0px 0px',
  });

  const isUnlocked = achievement.achieved;
  const isHidden = achievement.hidden && !isUnlocked;

  return (
    <motion.div
      ref={targetRef}
      className={styles.entry_root}
      data-unlocked={isUnlocked}
      data-hidden={isHidden}
      variants={entryVariants}
      initial="hidden"
      animate={isInteracting ? 'visible' : 'hidden'}
      transition={{
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index % 6, 5) * 0.05,
      }}
    >
      <TimeLineEntryBadge
        iconUrl={isUnlocked ? achievement.iconUrl : null}
        iconGrayUrl={achievement.iconGrayUrl}
        isHidden={isHidden}
        isUnlocked={isUnlocked}
      />

      <TimeLineEntryContent
        name={achievement.name}
        unlockedAt={achievement.unlockedAt}
        globalPercentage={achievement.globalPercentage}
        isUnlocked={isUnlocked}
        isHidden={isHidden}
      />
    </motion.div>
  );
}

export default TimeLineEntry;
